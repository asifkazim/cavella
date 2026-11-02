package pl.cavella.card.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import pl.cavella.card.domain.CardId;

@Repository
public class CardRepository {

    private final JdbcTemplate jdbc;

    public CardRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Inserts a new ACTIVE card with a zero balance. Returns {@code false} instead of failing on a
     * (practically impossible) id or token-hash collision, so the caller can retry without
     * aborting its transaction.
     */
    public boolean insertIfAbsent(CardId id, byte[] tokenHash, Instant createdAt) {
        return jdbc.update(
                        "INSERT INTO card (id, token_hash, status, created_at) VALUES (?, ?, 'ACTIVE', ?) "
                                + "ON CONFLICT DO NOTHING",
                        id.value(),
                        tokenHash,
                        OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC))
                == 1;
    }
}
