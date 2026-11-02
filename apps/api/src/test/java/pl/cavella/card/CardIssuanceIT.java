package pl.cavella.card;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static pl.cavella.support.SecurityContexts.callAnonymously;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import pl.cavella.card.application.CardService;
import pl.cavella.card.application.IssuedCard;
import pl.cavella.card.domain.CardToken;
import pl.cavella.loyalty.application.BalanceView;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.domain.CardNotFoundException;
import pl.cavella.support.IntegrationTest;

/** Rule: each new card has a cryptographically random id (PRD FR-L-01, ADR-002). */
class CardIssuanceIT extends IntegrationTest {

    @Autowired
    CardService cards;

    @Autowired
    LoyaltyService loyalty;

    @Test
    void customersCanGetACardWithoutAnyAccount() throws Exception {
        IssuedCard card = callAnonymously(cards::issueCard);

        assertThat(card.token().value()).matches("^[A-Za-z0-9_-]{22}$");
        assertThat(projection(card.id())).containsExactly(0, 0);
    }

    @Test
    void everyCardGetsAUniqueRandomIdAndToken() throws Exception {
        List<IssuedCard> issued = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            issued.add(callAnonymously(cards::issueCard));
        }

        assertThat(new HashSet<>(issued.stream().map(IssuedCard::id).toList())).hasSize(200);
        assertThat(new HashSet<>(issued.stream().map(c -> c.token().value()).toList())).hasSize(200);
        // Random (v4) UUIDs, not sequential ids that could be enumerated (PRD T-03).
        assertThat(issued).allSatisfy(c -> assertThat(c.id().value().version()).isEqualTo(4));
    }

    @Test
    void onlyTheTokenHashIsStoredNeverTheTokenItself() throws Exception {
        IssuedCard card = callAnonymously(cards::issueCard);

        byte[] storedHash = jdbc.queryForObject(
                "SELECT token_hash FROM card WHERE id = ?", byte[].class, card.id().value());
        assertThat(storedHash).isEqualTo(card.token().sha256());

        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM card WHERE id = ?", card.id().value());
        assertThat(row.values())
                .noneMatch(value -> value != null && String.valueOf(value).contains(card.token().value()));
    }

    @Test
    void theTokenHolderCanReadTheBalanceWithoutLoggingIn() throws Exception {
        IssuedCard card = callAnonymously(cards::issueCard);

        BalanceView balance = callAnonymously(() -> loyalty.balanceForToken(card.token()));

        assertThat(balance).isEqualTo(new BalanceView(0, 6, 0));
    }

    @Test
    void anUnknownTokenIsReportedAsNotFound() {
        CardToken unknown = CardToken.parse("AAECAwQFBgcICQoLDA0ODw");

        assertThatThrownBy(() -> callAnonymously(() -> loyalty.balanceForToken(unknown)))
                .isInstanceOf(CardNotFoundException.class);
    }
}
