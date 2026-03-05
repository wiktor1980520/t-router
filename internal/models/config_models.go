package models

import (
	"time"

	"gorm.io/gorm"
)

type SystemConfig struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Key         string    `gorm:"uniqueIndex;not null" json:"key"`
	Value       string    `gorm:"not null" json:"value"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Seed default configurations
func SeedSystemConfigs(db *gorm.DB) {
	configs := []SystemConfig{
		{Key: "new_user_gift_amount", Value: "1.0", Description: "Initial balance gifted to new users"},
	}

	for _, config := range configs {
		var count int64
		db.Model(&SystemConfig{}).Where("key = ?", config.Key).Count(&count)
		if count == 0 {
			db.Create(&config)
		}
	}
}
