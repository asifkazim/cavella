package pl.cavella.support;

import java.util.UUID;
import pl.cavella.staff.StaffId;
import pl.cavella.staff.StaffPrincipal;
import pl.cavella.staff.StaffRole;

/** Staff accounts seeded before every integration test (see {@link IntegrationTest}). */
public final class Staff {

    public static final StaffPrincipal CASHIER_ANNA =
            new StaffPrincipal(new StaffId(UUID.fromString("00000000-0000-4000-8000-00000000a001")), StaffRole.CASHIER);
    public static final StaffPrincipal CASHIER_BARTEK =
            new StaffPrincipal(new StaffId(UUID.fromString("00000000-0000-4000-8000-00000000a002")), StaffRole.CASHIER);
    public static final StaffPrincipal OWNER_OLA =
            new StaffPrincipal(new StaffId(UUID.fromString("00000000-0000-4000-8000-00000000a003")), StaffRole.OWNER);

    private Staff() {}
}
