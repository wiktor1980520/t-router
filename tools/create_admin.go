package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Minimal User model to avoid importing the whole internal package if not needed,
// but better to match the actual schema.
type User struct {
	ID                    string    `gorm:"primaryKey;size:36"`
	Email                 string    `gorm:"uniqueIndex;not null"`
	Phone                 *string   `gorm:"uniqueIndex;size:20"`
	PasswordHash          string    `gorm:"default:'';not null"`
	Balance               float64   `gorm:"type:decimal(20,8);default:0"`
	BalanceAlertThreshold float64   `gorm:"type:decimal(20,8);default:10.00"`
	IsActive              bool      `gorm:"default:true"`
	IsAdmin               bool      `gorm:"default:false"`
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

func main() {
	// Load .env
	_ = godotenv.Load()

	email := flag.String("email", "", "Email of the admin user")
	password := flag.String("password", "", "Password for the admin user (required for new users)")
	phone := flag.String("phone", "", "Phone number (optional)")
	flag.Parse()

	if *email == "" {
		log.Fatal("Email is required. Usage: go run tools/create_admin.go -email=admin@example.com -password=secret")
	}

	var dialector gorm.Dialector
	dsn := os.Getenv("DATABASE_URL")
	
	if dsn != "" {
		fmt.Println("Using PostgreSQL database...")
		dialector = postgres.Open(dsn)
	} else {
		fmt.Println("DATABASE_URL not set, using SQLite (trouter.db)...")
		dialector = sqlite.Open("trouter.db")
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	var user User
	err = db.Where("email = ?", *email).First(&user).Error

	if err == nil {
		// User exists, promote to admin
		fmt.Printf("User %s found. Promoting to admin...\n", *email)
		user.IsAdmin = true
		if *password != "" {
			fmt.Println("Updating password...")
			hash, _ := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
			user.PasswordHash = string(hash)
		}
		if err := db.Save(&user).Error; err != nil {
			log.Fatalf("Failed to update user: %v", err)
		}
		fmt.Println("Success! User is now an admin.")
	} else if err == gorm.ErrRecordNotFound {
		// User does not exist, create new
		if *password == "" {
			log.Fatal("Password is required for creating a new user")
		}
		fmt.Printf("Creating new admin user %s...\n", *email)
		
		hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash password: %v", err)
		}

		newUser := User{
			ID:           uuid.New().String(),
			Email:        *email,
			PasswordHash: string(hash),
			IsAdmin:      true,
			IsActive:     true,
			Balance:      0,
		}
		if *phone != "" {
			newUser.Phone = phone
		}

		if err := db.Create(&newUser).Error; err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}
		fmt.Println("Success! Admin user created.")
	} else {
		log.Fatalf("Database error: %v", err)
	}
}
