package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
)

type adminModelMetric struct {
	Model        string  `json:"model"`
	Calls        int64   `json:"calls"`
	Tokens       int64   `json:"tokens"`
	Revenue      float64 `json:"revenue"`
	ProviderCost float64 `json:"provider_cost"`
	Profit       float64 `json:"profit"`
	AvgLatencyMS float64 `json:"avg_latency_ms"`
}

type adminOverviewMetrics struct {
	Days              int                `json:"days"`
	TotalUsers        int64              `json:"total_users"`
	NewUsers          int64              `json:"new_users"`
	ActiveUsers       int64              `json:"active_users"`
	Calls             int64              `json:"calls"`
	SuccessfulCalls   int64              `json:"successful_calls"`
	SuccessRate       float64            `json:"success_rate"`
	Tokens            int64              `json:"tokens"`
	RechargeAmount    float64            `json:"recharge_amount"`
	ConsumptionAmount float64            `json:"consumption_amount"`
	ProviderCost      float64            `json:"provider_cost"`
	GrossProfit       float64            `json:"gross_profit"`
	GrossMargin       float64            `json:"gross_margin"`
	TopModels         []adminModelMetric `json:"top_models"`
}

type adminInvitationMetric struct {
	Code              string  `json:"code"`
	Remark            string  `json:"remark"`
	Registrations     int64   `json:"registrations"`
	ActivatedUsers    int64   `json:"activated_users"`
	RechargedUsers    int64   `json:"recharged_users"`
	RechargeAmount    float64 `json:"recharge_amount"`
	ConsumptionAmount float64 `json:"consumption_amount"`
}

func parseDays(c *gin.Context, def int) int {
	days := def
	if v := c.Query("days"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 365 {
			days = n
		}
	}
	return days
}

func AdminMetricsOverviewHandler(c *gin.Context) {
	days := parseDays(c, 7)
	since := time.Now().AddDate(0, 0, -days)

	var totalUsers int64
	config.DB.Model(&models.User{}).Count(&totalUsers)

	var newUsers int64
	config.DB.Model(&models.User{}).Where("created_at >= ?", since).Count(&newUsers)

	var calls int64
	config.DB.Model(&models.AuditLog{}).Where("created_at >= ?", since).Count(&calls)

	var successfulCalls int64
	config.DB.Model(&models.AuditLog{}).Where("created_at >= ? AND status_code = ?", since, http.StatusOK).Count(&successfulCalls)

	var activeUsers int64
	config.DB.Table("audit_logs").Select("COUNT(DISTINCT user_id)").Where("created_at >= ? AND status_code = ?", since, http.StatusOK).Scan(&activeUsers)

	type tokenAgg struct {
		Tokens int64 `gorm:"column:tokens"`
	}
	var tokensRow tokenAgg
	config.DB.Table("audit_logs").
		Select("COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens").
		Where("created_at >= ?", since).
		Scan(&tokensRow)

	type costAgg struct {
		ConsumptionAmount float64 `gorm:"column:consumption_amount"`
		ProviderCost      float64 `gorm:"column:provider_cost"`
	}
	var costRow costAgg
	config.DB.Table("audit_logs").
		Select("COALESCE(SUM(total_cost), 0) AS consumption_amount, COALESCE(SUM(provider_cost), 0) AS provider_cost").
		Where("created_at >= ?", since).
		Scan(&costRow)

	type rechargeAgg struct {
		RechargeAmount float64 `gorm:"column:recharge_amount"`
	}
	var rechargeRow rechargeAgg
	config.DB.Table("transactions").
		Select("COALESCE(SUM(amount), 0) AS recharge_amount").
		Where("created_at >= ? AND type = ? AND status = ?", since, "recharge", "completed").
		Scan(&rechargeRow)

	topModels := make([]adminModelMetric, 0)
	config.DB.Table("audit_logs").
		Select(`
			model AS model,
			COUNT(*) AS calls,
			COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens,
			COALESCE(SUM(total_cost), 0) AS revenue,
			COALESCE(SUM(provider_cost), 0) AS provider_cost,
			COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
		`).
		Where("created_at >= ? AND status_code = ?", since, http.StatusOK).
		Group("model").
		Order("revenue DESC").
		Limit(10).
		Scan(&topModels)

	for i := range topModels {
		topModels[i].Profit = topModels[i].Revenue - topModels[i].ProviderCost
	}

	successRate := 0.0
	if calls > 0 {
		successRate = float64(successfulCalls) / float64(calls)
	}

	grossProfit := costRow.ConsumptionAmount - costRow.ProviderCost
	grossMargin := 0.0
	if costRow.ConsumptionAmount > 0 {
		grossMargin = grossProfit / costRow.ConsumptionAmount
	}

	c.JSON(http.StatusOK, adminOverviewMetrics{
		Days:              days,
		TotalUsers:        totalUsers,
		NewUsers:          newUsers,
		ActiveUsers:       activeUsers,
		Calls:             calls,
		SuccessfulCalls:   successfulCalls,
		SuccessRate:       successRate,
		Tokens:            tokensRow.Tokens,
		RechargeAmount:    rechargeRow.RechargeAmount,
		ConsumptionAmount: costRow.ConsumptionAmount,
		ProviderCost:      costRow.ProviderCost,
		GrossProfit:       grossProfit,
		GrossMargin:       grossMargin,
		TopModels:         topModels,
	})
}

func AdminInvitationMetricsHandler(c *gin.Context) {
	days := parseDays(c, 30)
	since := time.Now().AddDate(0, 0, -days)

	type codeBase struct {
		Code   string `json:"code"`
		Remark string `json:"remark"`
	}
	var bases []codeBase
	if err := config.DB.Table("invitation_codes").Select("code, remark").Order("created_at desc").Scan(&bases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invitation codes"})
		return
	}

	regByCode := map[string]int64{}
	actByCode := map[string]int64{}
	rechargeUsersByCode := map[string]int64{}
	rechargeAmountByCode := map[string]float64{}
	consAmountByCode := map[string]float64{}

	type kvCount struct {
		Code  string `gorm:"column:code"`
		Count int64  `gorm:"column:count"`
	}
	type kvSum struct {
		Code  string  `gorm:"column:code"`
		Sum   float64 `gorm:"column:sum"`
		Count int64   `gorm:"column:count"`
	}

	var regs []kvCount
	config.DB.Table("users AS u").
		Select("UPPER(u.invitation_code) AS code, COUNT(*) AS count").
		Where("u.created_at >= ? AND u.invitation_code IS NOT NULL AND TRIM(u.invitation_code) <> ''", since).
		Group("UPPER(u.invitation_code)").
		Scan(&regs)
	for _, r := range regs {
		regByCode[r.Code] = r.Count
	}

	var acts []kvCount
	config.DB.Table("users AS u").
		Select("UPPER(u.invitation_code) AS code, COUNT(DISTINCT u.id) AS count").
		Joins("JOIN audit_logs a ON a.user_id = u.id").
		Where("u.created_at >= ? AND a.created_at >= ? AND a.status_code = ? AND u.invitation_code IS NOT NULL AND TRIM(u.invitation_code) <> ''", since, since, http.StatusOK).
		Group("UPPER(u.invitation_code)").
		Scan(&acts)
	for _, a := range acts {
		actByCode[a.Code] = a.Count
	}

	var recharges []kvSum
	config.DB.Table("users AS u").
		Select("UPPER(u.invitation_code) AS code, COUNT(DISTINCT u.id) AS count, COALESCE(SUM(t.amount), 0) AS sum").
		Joins("JOIN transactions t ON t.user_id = u.id").
		Where("u.created_at >= ? AND t.created_at >= ? AND t.type = ? AND t.status = ? AND u.invitation_code IS NOT NULL AND TRIM(u.invitation_code) <> ''", since, since, "recharge", "completed").
		Group("UPPER(u.invitation_code)").
		Scan(&recharges)
	for _, r := range recharges {
		rechargeUsersByCode[r.Code] = r.Count
		rechargeAmountByCode[r.Code] = r.Sum
	}

	var consumptions []kvSum
	config.DB.Table("users AS u").
		Select("UPPER(u.invitation_code) AS code, 0 AS count, COALESCE(SUM(a.total_cost), 0) AS sum").
		Joins("JOIN audit_logs a ON a.user_id = u.id").
		Where("u.created_at >= ? AND a.created_at >= ? AND a.status_code = ? AND u.invitation_code IS NOT NULL AND TRIM(u.invitation_code) <> ''", since, since, http.StatusOK).
		Group("UPPER(u.invitation_code)").
		Scan(&consumptions)
	for _, r := range consumptions {
		consAmountByCode[r.Code] = r.Sum
	}

	out := make([]adminInvitationMetric, 0, len(bases))
	seen := map[string]bool{}
	for _, b := range bases {
		code := b.Code
		uc := code
		if uc != "" {
			uc = strings.ToUpper(strings.TrimSpace(uc))
		}
		seen[uc] = true
		out = append(out, adminInvitationMetric{
			Code:              code,
			Remark:            b.Remark,
			Registrations:     regByCode[uc],
			ActivatedUsers:    actByCode[uc],
			RechargedUsers:    rechargeUsersByCode[uc],
			RechargeAmount:    rechargeAmountByCode[uc],
			ConsumptionAmount: consAmountByCode[uc],
		})
	}

	for code, registrations := range regByCode {
		if seen[code] {
			continue
		}
		out = append(out, adminInvitationMetric{
			Code:              code,
			Remark:            "",
			Registrations:     registrations,
			ActivatedUsers:    actByCode[code],
			RechargedUsers:    rechargeUsersByCode[code],
			RechargeAmount:    rechargeAmountByCode[code],
			ConsumptionAmount: consAmountByCode[code],
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"days":  days,
		"since": since,
		"items": out,
	})
}
