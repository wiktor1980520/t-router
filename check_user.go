//go:build tools

package main

import (
	"fmt"
	"log"
	"trouter/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func main() {
	db, err := gorm.Open(sqlite.Open("trouter.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var user models.User
	result := db.Where("email = ?", "admin@t-router.com").First(&user)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			fmt.Println("User not found")
		} else {
			log.Fatal(result.Error)
		}
	} else {
		fmt.Printf("User found: ID=%s, Email=%s, IsAdmin=%v, IsActive=%v\n", user.ID, user.Email, user.IsAdmin, user.IsActive)
	}
}
