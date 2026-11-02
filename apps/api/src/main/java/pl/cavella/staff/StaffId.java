package pl.cavella.staff;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Identifier of an individual staff account (PRD FR-S-01: no shared credentials). */
public record StaffId(UUID value) implements Serializable {

    public StaffId {
        Objects.requireNonNull(value, "value");
    }
}
