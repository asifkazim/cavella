package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import pl.cavella.card.domain.CardId;
import pl.cavella.support.ApiIntegrationTest;
import pl.cavella.support.Staff;

/** Cashier and owner endpoints over HTTP: auth, idempotency, validation and error contract. */
class StaffLoyaltyApiIT extends ApiIntegrationTest {

    private StaffSession cashier;

    @BeforeEach
    void logInCashier() throws Exception {
        cashier = login(Staff.CASHIER_ANNA);
    }

    private ResultActions stamp(StaffSession session, CardId card, String key, String body) throws Exception {
        var request = session.apply(post("/api/v1/staff/cards/{id}/stamps", card.value()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
        if (key != null) {
            request.header("Idempotency-Key", key);
        }
        return mvc.perform(fromClient(request));
    }

    private ResultActions redeem(StaffSession session, CardId card, String key) throws Exception {
        return mvc.perform(fromClient(session.apply(post("/api/v1/staff/cards/{id}/redemptions", card.value()))
                .header("Idempotency-Key", key)));
    }

    @Test
    void aCashierAddsAStampAndARetryIsReplayedNotRepeated() throws Exception {
        CardId card = givenCard(5, 0);
        String key = UUID.randomUUID().toString();

        MvcResult first = stamp(cashier, card, key, "{\"quantity\":1}")
                .andExpect(status().isCreated())
                .andExpect(header().doesNotExist("Idempotent-Replayed"))
                .andExpect(jsonPath("$.rewardsEarned").value(1))
                .andExpect(jsonPath("$.balance.stampProgress").value(0))
                .andExpect(jsonPath("$.balance.rewardsAvailable").value(1))
                .andReturn();
        String eventId = JsonPath.read(first.getResponse().getContentAsString(), "$.eventId");

        stamp(cashier, card, key, "{\"quantity\":1}")
                .andExpect(status().isCreated())
                .andExpect(header().string("Idempotent-Replayed", "true"))
                .andExpect(jsonPath("$.eventId").value(eventId));

        assertThat(ledgerCount(card)).isEqualTo(1);
    }

    @Test
    void aCashierRedeemsARewardOnce() throws Exception {
        CardId card = givenCard(2, 1);

        redeem(cashier, card, UUID.randomUUID().toString())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.balance.rewardsAvailable").value(0));
        redeem(cashier, card, UUID.randomUUID().toString())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NO_REWARD_AVAILABLE"));
    }

    @Test
    void mutationsRequireAValidIdempotencyKey() throws Exception {
        CardId card = givenCard(0, 0);

        stamp(cashier, card, null, "{\"quantity\":1}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REQUIRED"));
        stamp(cashier, card, "not-a-uuid", "{\"quantity\":1}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        assertThat(ledgerCount(card)).isZero();
    }

    @Test
    void requestBodiesAndParametersAreValidated() throws Exception {
        CardId card = givenCard(0, 0);
        String key = UUID.randomUUID().toString();

        stamp(cashier, card, key, "{\"quantity\":0}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("quantity"));
        stamp(cashier, card, key, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        stamp(cashier, card, key, "{\"quantity\":1,\"staffId\":\"someone-else\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        stamp(cashier, card, key, "{\"quantity\":")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(fromClient(cashier.apply(post("/api/v1/staff/cards/not-a-uuid/stamps")))
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        assertThat(ledgerCount(card)).isZero();
    }

    @Test
    void businessRulesSurfaceTheirStableCodes() throws Exception {
        CardId card = givenCard(0, 0);
        String key = UUID.randomUUID().toString();

        stamp(cashier, card, UUID.randomUUID().toString(), "{\"quantity\":4}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("QUANTITY_EXCEEDS_CAP"));
        stamp(cashier, new CardId(UUID.randomUUID()), UUID.randomUUID().toString(), "{\"quantity\":1}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CARD_NOT_FOUND"));
        stamp(cashier, card, key, "{\"quantity\":1}").andExpect(status().isCreated());
        stamp(cashier, card, key, "{\"quantity\":2}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void aScannedTokenResolvesToTheCardSummary() throws Exception {
        MvcResult created = mvc.perform(fromClient(post("/api/v1/cards"))).andExpect(status().isCreated()).andReturn();
        String token = JsonPath.read(created.getResponse().getContentAsString(), "$.token");

        mvc.perform(fromClient(cashier.apply(post("/api/v1/staff/cards/lookup")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cardId").exists())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.balance.stampProgress").value(0));

        mvc.perform(fromClient(cashier.apply(post("/api/v1/staff/cards/lookup")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"https://cavella.pl/c#nope\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CARD_NOT_FOUND"));
    }

    @Test
    void stateChangingRequestsWithoutAStaffSessionAreRejected() throws Exception {
        CardId card = givenCard(0, 1);
        StaffSession anonymous = anonymousSession(); // has a valid CSRF token, but nobody is logged in

        stamp(anonymous, card, UUID.randomUUID().toString(), "{\"quantity\":1}")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(fromClient(post("/api/v1/staff/cards/{id}/redemptions", card.value()).cookie(cashier.cookie()))
                        .header("Idempotency-Key", UUID.randomUUID().toString()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(ledgerCount(card)).isZero();
    }

    @Test
    void onlyTheOwnerReadsTheAuditTrail() throws Exception {
        CardId card = givenCard(0, 0);
        stamp(cashier, card, UUID.randomUUID().toString(), "{\"quantity\":2}").andExpect(status().isCreated());

        mvc.perform(fromClient(get("/api/v1/admin/cards/{id}/events", card.value())).cookie(cashier.cookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        StaffSession owner = login(Staff.OWNER_OLA);
        mvc.perform(fromClient(get("/api/v1/admin/cards/{id}/events", card.value())).cookie(owner.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("STAMP"))
                .andExpect(jsonPath("$[0].quantity").value(2))
                .andExpect(jsonPath("$[0].staffId").value(Staff.CASHIER_ANNA.id().value().toString()));
    }

    @Test
    void unknownStaffRoutesAreNotFoundAndProblemsCarryTheRequestId() throws Exception {
        MvcResult result = mvc.perform(fromClient(get("/api/v1/staff/no-such-thing")).cookie(cashier.cookie()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andReturn();

        String requestId = JsonPath.read(result.getResponse().getContentAsString(), "$.requestId");
        assertThat(result.getResponse().getHeader("X-Request-Id")).isEqualTo(requestId);
    }
}
