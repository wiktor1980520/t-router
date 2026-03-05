package config

import (
	"log"
	"os"

	"trouter/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

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
		&models.Provider{},
		&models.ModelRoute{},
		&models.AuditLog{},
		&models.Model{},
		&models.VerificationCode{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	
	// Seed some initial data for testing if empty
	seedData()
	// Seed Admin User
	seedAdmin()

	log.Println("Database connected and migrated successfully.")
}

func seedAdmin() {
	var admin models.User
	// Check if admin exists by email
	err := DB.Where("email = ?", "admin@t-router.com").First(&admin).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Println("Seeding Admin User...")
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("Admin@123"), bcrypt.DefaultCost)
			phone := "13923708510"
			
			admin = models.User{
				Email:        "admin@t-router.com",
				Phone:        &phone,
				PasswordHash: string(hashedPassword),
				Balance:      1000.00, 
				IsActive:     true,
				IsAdmin:      true,
			}
			if err := DB.Create(&admin).Error; err != nil {
				log.Printf("Failed to create admin user: %v", err)
			} else {
				log.Printf("Admin User Created: admin@t-router.com / Admin@123")
			}
		}
	} else {
		// Ensure IsAdmin is true if user exists
		if !admin.IsAdmin {
			admin.IsAdmin = true
			DB.Save(&admin)
			log.Println("Promoted existing user admin@t-router.com to Admin.")
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
			Email:    "test@example.com",
			PasswordHash: string(hashedPassword),
			Balance:  100.00,
			IsActive: true,
		}
		DB.Create(&user)

		// Create a test API Key (sk-test-123456)
		apiKey := models.ApiKey{
			UserID:    user.ID,
			KeyHash:   "sk-test-123456", // Mock hash for simplicity
			KeyPrefix: "sk-test",
			Label:     "Default Key",
			IsActive:  true,
		}
		DB.Create(&apiKey)
		
		log.Printf("Seeded User ID: %s, API Key: sk-test-123456, Password: password123", user.ID)
	}
}
