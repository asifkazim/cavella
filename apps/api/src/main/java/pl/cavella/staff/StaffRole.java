package pl.cavella.staff;

/** Staff roles (ARCHITECTURE §7). Spring authorities are {@code ROLE_<name>}. */
public enum StaffRole {
    CASHIER,
    OWNER;

    public String authority() {
        return "ROLE_" + name();
    }
}
