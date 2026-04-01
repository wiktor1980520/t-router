package api

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"time"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func getOrgMemberRole(orgID string, userID string) (string, error) {
	var m models.OrgMember
	if err := config.DB.First(&m, "org_id = ? AND user_id = ?", orgID, userID).Error; err != nil {
		return "", err
	}
	return m.Role, nil
}

func requireOrgAdmin(c *gin.Context, orgID string) bool {
	userID := c.GetString("user_id")
	role, err := getOrgMemberRole(orgID, userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization access denied"})
		return false
	}
	if role != "owner" && role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization admin required"})
		return false
	}
	return true
}

func CreateOrganizationHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	var req struct {
		Name          string  `json:"name" binding:"required"`
		MonthlyBudget float64 `json:"monthly_budget"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	org := models.Organization{
		ID:            uuid.New().String(),
		Name:          req.Name,
		OwnerID:       userID,
		MonthlyBudget: req.MonthlyBudget,
		IsActive:      true,
	}
	member := models.OrgMember{
		ID:     uuid.New().String(),
		OrgID:  org.ID,
		UserID: userID,
		Role:   "owner",
	}
	tx := config.DB.Begin()
	if err := tx.Create(&org).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
		return
	}
	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create membership"})
		return
	}
	tx.Commit()
	c.JSON(http.StatusCreated, org)
}

func ListMyOrganizationsHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	type row struct {
		ID            string  `json:"id"`
		Name          string  `json:"name"`
		OwnerID       string  `json:"owner_id"`
		MonthlyBudget float64 `json:"monthly_budget"`
		IsActive      bool    `json:"is_active"`
		Role          string  `json:"role"`
	}
	rows := make([]row, 0)
	if err := config.DB.Table("org_members AS m").
		Select("o.id, o.name, o.owner_id, o.monthly_budget, o.is_active, m.role").
		Joins("JOIN organizations o ON o.id = m.org_id").
		Where("m.user_id = ?", userID).
		Order("o.created_at desc").
		Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch organizations"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

func GetOrganizationHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	orgID := c.Param("id")

	if _, err := getOrgMemberRole(orgID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization access denied"})
		return
	}

	var org models.Organization
	if err := config.DB.First(&org, "id = ?", orgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	type memberRow struct {
		UserID string `json:"user_id"`
		Email  string `json:"email"`
		Role   string `json:"role"`
	}
	members := make([]memberRow, 0)
	config.DB.Table("org_members AS m").
		Select("m.user_id, u.email, m.role").
		Joins("JOIN users u ON u.id = m.user_id").
		Where("m.org_id = ?", orgID).
		Order("m.created_at asc").
		Scan(&members)

	period := time.Now().Format("2006-01")
	var usage models.OrgUsage
	spent := 0.0
	if err := config.DB.Where("org_id = ? AND period = ?", orgID, period).First(&usage).Error; err == nil {
		spent = usage.Spent
	}

	c.JSON(http.StatusOK, gin.H{
		"org":     org,
		"members": members,
		"period":  period,
		"spent":   spent,
	})
}

func UpdateOrganizationHandler(c *gin.Context) {
	orgID := c.Param("id")
	if !requireOrgAdmin(c, orgID) {
		return
	}

	var req struct {
		Name          *string  `json:"name"`
		MonthlyBudget *float64 `json:"monthly_budget"`
		IsActive      *bool    `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.MonthlyBudget != nil {
		updates["monthly_budget"] = *req.MonthlyBudget
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No updates"})
		return
	}

	if err := config.DB.Model(&models.Organization{}).Where("id = ?", orgID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func AddOrganizationMemberHandler(c *gin.Context) {
	orgID := c.Param("id")
	if !requireOrgAdmin(c, orgID) {
		return
	}

	var req struct {
		Email string `json:"email" binding:"required,email"`
		Role  string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	role := req.Role
	if role == "" {
		role = "member"
	}

	var u models.User
	if err := config.DB.Select("id, email").First(&u, "email = ?", req.Email).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	m := models.OrgMember{
		ID:     uuid.New().String(),
		OrgID:  orgID,
		UserID: u.ID,
		Role:   role,
	}
	if err := config.DB.Create(&m).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member"})
		return
	}
	c.JSON(http.StatusCreated, m)
}

func RemoveOrganizationMemberHandler(c *gin.Context) {
	orgID := c.Param("id")
	if !requireOrgAdmin(c, orgID) {
		return
	}
	memberUserID := c.Param("user_id")
	if err := config.DB.Delete(&models.OrgMember{}, "org_id = ? AND user_id = ?", orgID, memberUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Removed"})
}

func AttachApiKeyToOrganizationHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	orgID := c.Param("id")
	keyID := c.Param("key_id")

	if _, err := getOrgMemberRole(orgID, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Organization access denied"})
		return
	}

	var key models.ApiKey
	if err := config.DB.First(&key, "id = ? AND user_id = ?", keyID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "API key not found"})
		return
	}

	if err := config.DB.Model(&models.ApiKey{}).Where("id = ?", key.ID).Update("org_id", orgID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to attach API key"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Attached"})
}

func ExportOrganizationAuditLogsHandler(c *gin.Context) {
	orgID := c.Param("id")
	if !requireOrgAdmin(c, orgID) {
		return
	}

	fromStr := c.Query("from")
	toStr := c.Query("to")
	var from time.Time
	var to time.Time
	var err error
	if fromStr == "" {
		from = time.Now().AddDate(0, 0, -7)
	} else {
		from, err = time.Parse("2006-01-02", fromStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid from"})
			return
		}
	}
	if toStr == "" {
		to = time.Now()
	} else {
		to, err = time.Parse("2006-01-02", toStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid to"})
			return
		}
		to = to.Add(24 * time.Hour)
	}

	var logs []models.AuditLog
	if err := config.DB.Where("org_id = ? AND created_at >= ? AND created_at < ?", orgID, from, to).Order("created_at desc").Limit(20000).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=org_audit_logs.csv")
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"created_at", "request_id", "user_id", "model", "provider_id", "status_code", "latency_ms", "prompt_tokens", "completion_tokens", "total_cost", "provider_cost", "client_ip"})
	for _, l := range logs {
		_ = w.Write([]string{
			l.CreatedAt.Format(time.RFC3339),
			l.RequestID,
			l.UserID,
			l.Model,
			strconv.FormatUint(uint64(l.ProviderID), 10),
			strconv.Itoa(l.StatusCode),
			strconv.FormatInt(l.LatencyMS, 10),
			strconv.Itoa(l.PromptTokens),
			strconv.Itoa(l.CompletionTokens),
			strconv.FormatFloat(l.TotalCost, 'f', 8, 64),
			strconv.FormatFloat(l.ProviderCost, 'f', 8, 64),
			l.ClientIP,
		})
	}
	w.Flush()
}
