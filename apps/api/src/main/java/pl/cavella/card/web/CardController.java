package pl.cavella.card.web;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.cavella.card.application.CardService;
import pl.cavella.card.application.IssuedCard;
import pl.cavella.card.domain.CardToken;
import pl.cavella.loyalty.application.BalanceView;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.domain.CardNotFoundException;
import pl.cavella.shared.web.RateLimitProperties;
import pl.cavella.shared.web.RateLimiter;

/**
 * Public card endpoints (ARCHITECTURE §5.2). The bearer token travels only in the
 * {@code X-Card-Token} header — never in a URL — so it stays out of access logs (ADR-002).
 */
@RestController
@RequestMapping("/api/v1/cards")
class CardController {

    static final String TOKEN_HEADER = "X-Card-Token";

    record CardView(int stampProgress, int stampsPerReward, int rewardsAvailable) {
        static CardView of(BalanceView balance) {
            return new CardView(balance.stampProgress(), balance.stampsPerReward(), balance.rewardsAvailable());
        }
    }

    /** The token is returned exactly once, here. */
    record IssuedCardResponse(String token, CardView card) {}

    private final CardService cards;
    private final LoyaltyService loyalty;
    private final RateLimiter rateLimiter;
    private final RateLimitProperties limits;

    CardController(CardService cards, LoyaltyService loyalty, RateLimiter rateLimiter, RateLimitProperties limits) {
        this.cards = cards;
        this.loyalty = loyalty;
        this.rateLimiter = rateLimiter;
        this.limits = limits;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    IssuedCardResponse create(HttpServletRequest request) {
        rateLimiter.check("card-create", request.getRemoteAddr(), limits.cardCreationsPerHour(), Duration.ofHours(1));
        IssuedCard card = cards.issueCard();
        return new IssuedCardResponse(card.token().value(), CardView.of(loyalty.balanceForToken(card.token())));
    }

    @GetMapping("/self")
    CardView self(@RequestHeader(value = TOKEN_HEADER, required = false) String rawToken, HttpServletRequest request) {
        rateLimiter.check("card-read", request.getRemoteAddr(), limits.cardReadsPerMinute(), Duration.ofMinutes(1));
        return CardView.of(loyalty.balanceForToken(parseOrNotFound(rawToken)));
    }

    /** Missing, malformed and unknown tokens all look the same to the caller (no oracle, PRD E-20). */
    static CardToken parseOrNotFound(String raw) {
        try {
            return CardToken.parse(raw);
        } catch (IllegalArgumentException e) {
            throw new CardNotFoundException();
        }
    }
}
