package pl.cavella;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Cavella API — modular monolith (see docs/ARCHITECTURE.md §2.3). */
@SpringBootApplication
public class CavellaApplication {

    public static void main(String[] args) {
        SpringApplication.run(CavellaApplication.class, args);
    }
}
