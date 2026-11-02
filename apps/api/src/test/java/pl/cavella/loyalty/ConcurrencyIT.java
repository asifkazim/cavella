package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static pl.cavella.support.SecurityContexts.callAs;
import static pl.cavella.support.Staff.CASHIER_ANNA;
import static pl.cavella.support.Staff.CASHIER_BARTEK;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import pl.cavella.card.domain.CardId;
import pl.cavella.loyalty.application.AddStampsCommand;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.application.RedeemRewardCommand;
import pl.cavella.loyalty.application.RedemptionResult;
import pl.cavella.loyalty.application.StampResult;
import pl.cavella.loyalty.domain.NoRewardAvailableException;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.staff.StaffPrincipal;
import pl.cavella.support.IntegrationTest;

/**
 * Rule: concurrent requests preserve consistency (PRD AC-L-04, AC-L-05, E-02, E-03).
 * All tasks wait on one start gate so they hit the database at the same moment.
 */
class ConcurrencyIT extends IntegrationTest {

    private static final int THREADS = 20;

    @Autowired
    LoyaltyService loyalty;

    private ExecutorService pool;

    @AfterEach
    void stopPool() throws InterruptedException {
        if (pool != null) {
            pool.shutdownNow();
            assertThat(pool.awaitTermination(30, TimeUnit.SECONDS)).isTrue();
        }
    }

    /** Outcome of one task: the value, or the exception it threw. */
    private record Outcome<T>(T value, Throwable error) {}

    /** One platform thread per task, so every task can reach the start gate at the same time. */
    private <T> List<Outcome<T>> race(List<Callable<T>> tasks) throws InterruptedException {
        pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch go = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        for (Callable<T> task : tasks) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return task.call();
            }));
        }
        assertThat(ready.await(30, TimeUnit.SECONDS)).as("all tasks ready").isTrue();
        go.countDown();

        List<Outcome<T>> outcomes = new ArrayList<>();
        for (Future<T> future : futures) {
            try {
                outcomes.add(new Outcome<>(future.get(60, TimeUnit.SECONDS), null));
            } catch (ExecutionException e) {
                outcomes.add(new Outcome<>(null, e.getCause()));
            } catch (java.util.concurrent.TimeoutException e) {
                throw new AssertionError("task did not finish — possible deadlock", e);
            }
        }
        return outcomes;
    }

    private static <T> long successes(List<Outcome<T>> outcomes) {
        return outcomes.stream().filter(o -> o.error() == null).count();
    }

    @RepeatedTest(3)
    void twentyConcurrentRedemptionsOfOneRewardSucceedExactlyOnce() throws Exception {
        CardId card = givenCard(0, 1);
        List<Callable<RedemptionResult>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            StaffPrincipal staff = i % 2 == 0 ? CASHIER_ANNA : CASHIER_BARTEK;
            tasks.add(() -> callAs(staff,
                    () -> loyalty.redeemReward(new RedeemRewardCommand(card, IdempotencyKey.random()))));
        }

        List<Outcome<RedemptionResult>> outcomes = race(tasks);

        assertThat(successes(outcomes)).isEqualTo(1);
        assertThat(outcomes)
                .filteredOn(o -> o.error() != null)
                .allSatisfy(o -> assertThat(o.error()).isInstanceOf(NoRewardAvailableException.class));
        assertThat(projection(card)).containsExactly(0, 0);
        assertThat(ledgerCount(card, "REDEEM")).isEqualTo(1);
    }

    @RepeatedTest(3)
    void concurrentDuplicatesOfOneRequestCreateExactlyOneTransaction() throws Exception {
        CardId card = givenCard(0, 0);
        AddStampsCommand sameCommand = new AddStampsCommand(card, 1, IdempotencyKey.random());
        List<Callable<StampResult>> tasks = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            tasks.add(() -> callAs(CASHIER_ANNA, () -> loyalty.addStamps(sameCommand)));
        }

        List<Outcome<StampResult>> outcomes = race(tasks);

        assertThat(outcomes).allSatisfy(o -> assertThat(o.error()).isNull());
        assertThat(outcomes.stream().map(o -> o.value().eventId()).distinct()).hasSize(1);
        assertThat(outcomes.stream().filter(o -> !o.value().replayed())).hasSize(1);
        assertThat(ledgerCount(card)).isEqualTo(1);
        assertThat(projection(card)).containsExactly(1, 0);
    }

    @Test
    void concurrentStampsAreNeitherLostNorDoubleCounted() throws Exception {
        CardId card = givenCard(0, 0);
        List<Callable<StampResult>> tasks = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            StaffPrincipal staff = i % 2 == 0 ? CASHIER_ANNA : CASHIER_BARTEK;
            tasks.add(() -> callAs(staff,
                    () -> loyalty.addStamps(new AddStampsCommand(card, 1, IdempotencyKey.random()))));
        }

        List<Outcome<StampResult>> outcomes = race(tasks);

        assertThat(successes(outcomes)).isEqualTo(30);
        assertThat(projection(card)).containsExactly(0, 5); // 30 stamps = 5 rewards, no leftover
        assertThat(ledgerCount(card, "STAMP")).isEqualTo(30);
        assertThat(ledgerFold(card, 0, 0)).containsExactly(projection(card));
        assertThat(outcomes.stream().mapToInt(o -> o.value().rewardsEarned()).sum()).isEqualTo(5);
    }

    @RepeatedTest(3)
    void mixedConcurrentStampsAndRedemptionsKeepTheLedgerAndBalanceConsistent() throws Exception {
        CardId card = givenCard(4, 2);
        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            StaffPrincipal staff = i % 2 == 0 ? CASHIER_ANNA : CASHIER_BARTEK;
            tasks.add(() -> callAs(staff,
                    () -> loyalty.addStamps(new AddStampsCommand(card, 1, IdempotencyKey.random()))));
            tasks.add(() -> callAs(staff,
                    () -> loyalty.redeemReward(new RedeemRewardCommand(card, IdempotencyKey.random()))));
        }

        List<Outcome<Object>> outcomes = race(tasks);

        assertThat(outcomes)
                .filteredOn(o -> o.error() != null)
                .allSatisfy(o -> assertThat(o.error()).isInstanceOf(NoRewardAvailableException.class));
        int[] balance = projection(card);
        assertThat(balance[1]).as("rewards never negative").isGreaterThanOrEqualTo(0);
        assertThat(ledgerFold(card, 4, 2)).containsExactly(balance);
        assertThat(ledgerCount(card, "STAMP")).isEqualTo(12);
        long redemptions = outcomes.stream().filter(o -> o.value() instanceof RedemptionResult).count();
        assertThat(ledgerCount(card, "REDEEM")).isEqualTo((int) redemptions);
        // 4 + 12 stamps = 16 → 2 new rewards; with 2 to start, at most 4 redemptions can succeed.
        assertThat(redemptions).isBetween(2L, 4L);
    }
}
