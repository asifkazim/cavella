package pl.cavella.card.application;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.cavella.card.domain.CardId;
import pl.cavella.card.domain.CardToken;
import pl.cavella.card.persistence.CardRepository;

/**
 * Card issuance (PRD FR-L-01, ADR-002).
 *
 * <p>Contract for {@link #issueCard()}:
 * <ul>
 *   <li>Callable without authentication (customers create their own cards).</li>
 *   <li>Generates a fresh {@code CardToken} from a {@code SecureRandom} and a random {@code CardId}.</li>
 *   <li>Persists the card as ACTIVE with a zero balance and stores only {@code SHA-256(token)}.</li>
 * </ul>
 */
@Service
public class CardService {

    /** A collision of 128-bit randoms is astronomically unlikely; this only bounds the loop. */
    private static final int MAX_ATTEMPTS = 3;

    private final CardRepository cards;
    private final SecureRandom random;
    private final Clock clock;

    public CardService(CardRepository cards, SecureRandom random, Clock clock) {
        this.cards = cards;
        this.random = random;
        this.clock = clock;
    }

    @Transactional
    public IssuedCard issueCard() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            CardToken token = CardToken.generate(random);
            CardId id = new CardId(UUID.randomUUID()); // version 4, backed by SecureRandom
            if (cards.insertIfAbsent(id, token.sha256(), clock.instant())) {
                return new IssuedCard(id, token);
            }
        }
        throw new IllegalStateException("Could not issue a unique card after " + MAX_ATTEMPTS + " attempts");
    }
}
