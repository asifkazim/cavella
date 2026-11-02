package pl.cavella.card;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import pl.cavella.card.domain.CardToken;
import pl.cavella.support.ApiIntegrationTest;

/** Public card API: secure creation and retrieval by bearer token (ADR-002, PRD FR-L-01..06). */
class CardApiIT extends ApiIntegrationTest {

    private String createCard() throws Exception {
        MvcResult result = mvc.perform(fromClient(post("/api/v1/cards"))).andExpect(status().isCreated()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }

    @Test
    void createsACardAndReturnsItsTokenOnce() throws Exception {
        MvcResult result = mvc.perform(fromClient(post("/api/v1/cards")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value(matchesPattern("^[A-Za-z0-9_-]{22}$")))
                .andExpect(jsonPath("$.card.stampProgress").value(0))
                .andExpect(jsonPath("$.card.stampsPerReward").value(6))
                .andExpect(jsonPath("$.card.rewardsAvailable").value(0))
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andReturn();

        String token = JsonPath.read(result.getResponse().getContentAsString(), "$.token");
        byte[] stored = jdbc.queryForObject("SELECT token_hash FROM card", byte[].class);
        assertThat(stored).isEqualTo(CardToken.parse(token).sha256());
        // Customer endpoints never start a server-side session.
        assertThat(result.getResponse().getHeaders("Set-Cookie")).isEmpty();
    }

    @Test
    void theTokenHolderReadsTheBalanceWithTheTokenHeader() throws Exception {
        String token = createCard();

        mvc.perform(fromClient(get("/api/v1/cards/self")).header("X-Card-Token", token))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.stampProgress").value(0))
                .andExpect(jsonPath("$.rewardsAvailable").value(0));
    }

    @Test
    void missingMalformedAndUnknownTokensAllLookTheSame() throws Exception {
        for (String token : new String[] {null, "short", "AAECAwQFBgcICQoLDA0ODw"}) {
            var request = fromClient(get("/api/v1/cards/self"));
            if (token != null) {
                request.header("X-Card-Token", token);
            }
            mvc.perform(request)
                    .andExpect(status().isNotFound())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.code").value("CARD_NOT_FOUND"))
                    .andExpect(jsonPath("$.requestId").exists())
                    .andExpect(content().string(org.hamcrest.Matchers.not(containsString("AAECAwQFBgcICQoLDA0ODw"))));
        }
    }

    @Test
    void cardCreationIsRateLimitedPerClient() throws Exception {
        for (int i = 0; i < 5; i++) {
            createCard();
        }

        mvc.perform(fromClient(post("/api/v1/cards")))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        clientIp = "192.0.2.77"; // another client is unaffected
        mvc.perform(fromClient(post("/api/v1/cards"))).andExpect(status().isCreated());
    }
}
