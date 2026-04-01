package config

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"os"
	"strings"

	"trouter/internal/models"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func hashApiKeyForStorage(raw string) string {
	pepper := strings.TrimSpace(os.Getenv("API_KEY_PEPPER"))
	if pepper == "" {
		pepper = strings.TrimSpace(os.Getenv("JWT_SECRET"))
	}
	if pepper == "" {
		pepper = "default-secret-key-change-me"
	}
	sum := sha256.Sum256([]byte(pepper + ":" + raw))
	return "sha256:" + hex.EncodeToString(sum[:])
}

func InitDB() {
	var err error
	var dialector gorm.Dialector

	// Check if DATABASE_URL is set for Postgres
	dsn := os.Getenv("DATABASE_URL")

	if dsn != "" {
		log.Println("Using PostgreSQL database...")
		dialector = postgres.Open(dsn)
	} else {
		log.Println("DATABASE_URL not set, using SQLite (trouter.db)...")
		dialector = sqlite.Open("trouter.db")
	}

	DB, err = gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Failed to connect to database: %v. (If using local PostgreSQL, please ensure Docker is running and database is started via 'docker-compose up')", err)
	}

	// Auto Migrate Schema
	log.Println("Migrating database schema...")
	err = DB.AutoMigrate(
		&models.User{},
		&models.ApiKey{},
		&models.Transaction{},
		&models.PaymentOrder{},
		&models.SubscriptionPlan{},
		&models.UserSubscription{},
		&models.Organization{},
		&models.OrgMember{},
		&models.OrgUsage{},
		&models.Provider{},
		&models.ModelRoute{},
		&models.AuditLog{},
		&models.Model{},
		&models.VerificationCode{},
		&models.SystemConfig{},
		&models.InvitationCode{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Seed some initial data for testing if empty
	seedData()
	// Seed Admin User
	seedAdmin()
	// Seed System Configs
	models.SeedSystemConfigs(DB)

	log.Println("Database connected and migrated successfully.")
}

func seedAdmin() {
	adminEmail := os.Getenv("ADMIN_SEED_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@t-router.com"
	}
	adminPassword := os.Getenv("ADMIN_SEED_PASSWORD")
	adminPhone := os.Getenv("ADMIN_SEED_PHONE")

	var admin models.User
	// Check if admin exists by email
	err := DB.Where("email = ?", adminEmail).First(&admin).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			if adminPassword == "" {
				log.Printf("ADMIN_SEED_PASSWORD is empty, skipping admin seed for %s", adminEmail)
				return
			}
			log.Println("Seeding Admin User...")
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)

			var phonePtr *string
			if adminPhone != "" {
				phonePtr = &adminPhone
			}

			admin = models.User{
				Email:        adminEmail,
				Phone:        phonePtr,
				PasswordHash: string(hashedPassword),
				Balance:      1000.00,
				IsActive:     true,
				IsAdmin:      true,
			}
			if err := DB.Create(&admin).Error; err != nil {
				log.Printf("Failed to create admin user: %v", err)
			} else {
				log.Printf("Admin User Created: %s", adminEmail)
			}
		}
	} else {
		// Ensure IsAdmin is true if user exists
		if !admin.IsAdmin {
			admin.IsAdmin = true
			DB.Save(&admin)
			log.Printf("Promoted existing user %s to Admin.", adminEmail)
		}
		if adminPassword != "" {
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
			admin.PasswordHash = string(hashedPassword)
			DB.Save(&admin)
		}
	}
}

func seedData() {
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count == 0 {
		log.Println("Seeding initial data...")

		// Create a test user
		// Password is "password123"
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)

		user := models.User{
			Email:        "test@example.com",
			PasswordHash: string(hashedPassword),
			Balance:      100.00,
			IsActive:     true,
		}
		DB.Create(&user)

		// Create a test API Key (sk-test-123456)
		apiKey := models.ApiKey{
			UserID:    user.ID,
			KeyHash:   hashApiKeyForStorage("sk-test-123456"),
			KeyPrefix: "sk-test",
			Label:     "Default Key",
			IsActive:  true,
		}
		DB.Create(&apiKey)

		log.Printf("Seeded test user: %s", user.Email)
	}
}
