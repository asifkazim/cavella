package pl.cavella.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ClientAddressTest {

    @Test
    void ipv4AddressesAreTheirOwnKey() {
        assertThat(ClientAddress.rateLimitKey("203.0.113.7")).isEqualTo("203.0.113.7");
    }

    @Test
    void ipv6AddressesAreGroupedByTheirSlash64() {
        // One subscriber usually gets a whole /64 and can pick any address in it.
        String key = ClientAddress.rateLimitKey("2001:db8:aa:bb::1");
        assertThat(ClientAddress.rateLimitKey("2001:db8:aa:bb:ffff:ffff:ffff:ffff")).isEqualTo(key);
        assertThat(ClientAddress.rateLimitKey("2001:0db8:00aa:00bb:0:0:0:2")).as("same /64, other spelling").isEqualTo(key);
        assertThat(ClientAddress.rateLimitKey("2001:db8:aa:bc::1")).isNotEqualTo(key);
    }

    @Test
    void ipv4MappedIpv6IsTreatedAsIpv4() {
        assertThat(ClientAddress.rateLimitKey("::ffff:203.0.113.7")).isEqualTo("203.0.113.7");
    }

    @Test
    void unparseableOrMissingAddressesStillYieldAKeyWithoutAnyLookup() {
        assertThat(ClientAddress.rateLimitKey("zz:zz")).isEqualTo("zz:zz");
        assertThat(ClientAddress.rateLimitKey(null)).isEqualTo("unknown");
        assertThat(ClientAddress.rateLimitKey("")).isEqualTo("unknown");
    }
}
