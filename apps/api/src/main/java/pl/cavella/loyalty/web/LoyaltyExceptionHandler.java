package pl.cavella.loyalty.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import pl.cavella.loyalty.domain.LoyaltyException;
import pl.cavella.shared.web.Problems;

/** Maps loyalty business rejections to problems with their stable code (ARCHITECTURE §5.3). */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class LoyaltyExceptionHandler {

    @ExceptionHandler(LoyaltyException.class)
    ResponseEntity<ProblemDetail> loyalty(LoyaltyException e, HttpServletRequest request) {
        // Messages of LoyaltyException are fixed strings written for clients; they never echo input.
        return Problems.response(HttpStatus.valueOf(e.code().httpStatus()), e.code().name(), e.getMessage(), request);
    }
}
