package pl.cavella.shared.web;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HexFormat;

/**
 * Turns a client IP into a rate-limit key (M2). An IPv6 subscriber usually controls a whole
 * /64 and can rotate through it freely, so all addresses in a /64 count as one client.
 */
final class ClientAddress {

    private ClientAddress() {}

    static String rateLimitKey(String address) {
        if (address == null || address.isBlank()) {
            return "unknown";
        }
        if (address.indexOf(':') < 0) {
            return address; // IPv4
        }
        try {
            // Contains ':', so Java parses it as an IPv6 literal and never does a DNS lookup.
            InetAddress parsed = InetAddress.getByName(address);
            if (parsed instanceof Inet4Address v4) {
                return v4.getHostAddress(); // IPv4-mapped IPv6 (::ffff:a.b.c.d)
            }
            byte[] bytes = parsed.getAddress();
            return HexFormat.of().formatHex(bytes, 0, 8) + "::/64";
        } catch (UnknownHostException e) {
            return address; // not a valid literal: still a stable key
        }
    }
}
