package pl.cavella.loyalty.application;

/** Read model of a card balance, e.g. "4 of 6 stamps, 1 reward available". */
public record BalanceView(int stampProgress, int stampsPerReward, int rewardsAvailable) {}
