package router

import (
	"fmt"
	"math/rand"
	"sort"
	"sync"
	"time"

	"trouter/internal/config"
	"trouter/internal/models"
	"trouter/internal/provider"
	"trouter/internal/provider/factory"
)

// Router handles model routing logic
type Router struct {
	// Cache for provider instances to avoid recreating them on every request
	// map[ProviderID]provider.Provider
	providerCache sync.Map
}

var globalRouter *Router
var once sync.Once

func GetRouter() *Router {
	once.Do(func() {
		globalRouter = &Router{}
		// Initialize random seed
		rand.Seed(time.Now().UnixNano())
	})
	return globalRouter
}

// RouteResult contains the selected provider and the specific route config (for pricing)
type RouteResult struct {
	Provider   provider.Provider
	ModelRoute *models.ModelRoute
}

// Route selects the best providers for a given model based on preference
// Returns a list of providers to try in order (for fallback)
func (r *Router) Route(modelName string, preference string) ([]*RouteResult, error) {
	var routes []models.ModelRoute

	// 1. Find all active routes for this model, joining with Provider
	err := config.DB.Preload("Provider").
		Where("model_name = ? AND is_active = ?", modelName, true).
		Find(&routes).Error

	if err != nil {
		return nil, fmt.Errorf("database error fetching routes: %v", err)
	}

	if len(routes) == 0 {
		return nil, fmt.Errorf("no active route found for model: %s", modelName)
	}

	// 2. Sort/Group Routes based on Preference
	switch preference {
	case "lowest_cost":
		// Sort by Cost (Input + Output) Ascending
		sort.Slice(routes, func(i, j int) bool {
			costI := routes[i].CostInput + routes[i].CostOutput
			costJ := routes[j].CostInput + routes[j].CostOutput

			// If costs are equal, fallback to priority (higher is better)
			if costI == costJ {
				return routes[i].Priority > routes[j].Priority
			}
			return costI < costJ
		})
		// In lowest_cost mode, we just return the sorted list directly (no load balancing)
		// Because we want to strictly use the cheapest one first.

	case "lowest_latency":
		// Sort by Latency Ascending (Lower is better)
		// Latency is updated by background health check
		sort.Slice(routes, func(i, j int) bool {
			// If Latency is 0 (never checked), treat as high latency (push to bottom)
			latI := routes[i].Latency
			latJ := routes[j].Latency
			
			if latI == 0 && latJ == 0 {
				return routes[i].Priority > routes[j].Priority
			}
			if latI == 0 { return false } // I is unknown -> bigger than J
			if latJ == 0 { return true }  // J is unknown -> bigger than I

			if latI == latJ {
				return routes[i].Priority > routes[j].Priority
			}
			return latI < latJ
		})

	default: // "priority" or "load_balance" (default behavior)
		// Group by Priority
		// We want to randomize selection among the highest priority group
		routes = r.prioritizedLoadBalance(routes)
	}

	// 3. Build Result List (Candidates for Fallback)
	var results []*RouteResult
	for i := range routes {
		// Get or Create Provider Instance
		prov, err := r.getProviderInstance(&routes[i].Provider)
		if err != nil {
			fmt.Printf("Error creating provider instance for %s: %v\n", routes[i].Provider.Name, err)
			continue
		}

		results = append(results, &RouteResult{
			Provider:   prov,
			ModelRoute: &routes[i],
		})
	}

	return results, nil
}

// prioritizedLoadBalance sorts routes by Priority DESC, but performs Weighted Random Selection
// within groups of the same priority.
func (r *Router) prioritizedLoadBalance(routes []models.ModelRoute) []models.ModelRoute {
	// 1. Group by Priority
	groups := make(map[int][]models.ModelRoute)
	var priorities []int

	for _, route := range routes {
		p := route.Priority
		if _, exists := groups[p]; !exists {
			priorities = append(priorities, p)
		}
		groups[p] = append(groups[p], route)
	}

	// Sort priorities Descending (Higher = Better)
	sort.Sort(sort.Reverse(sort.IntSlice(priorities)))

	var finalOrder []models.ModelRoute

	// 2. Process each priority group
	for _, p := range priorities {
		group := groups[p]
		
		if len(group) == 1 {
			finalOrder = append(finalOrder, group[0])
			continue
		}

		// Shuffle/Weighted Select within this group
		// To support fallback, we need to order ALL of them, not just pick one.
		// We can do a "weighted shuffle":
		// Pick one based on weight, add to list, remove from pool, repeat.
		
		// Create a copy of group to manipulate
		pool := make([]models.ModelRoute, len(group))
		copy(pool, group)

		for len(pool) > 0 {
			selectedIdx := weightedSelectIndex(pool)
			finalOrder = append(finalOrder, pool[selectedIdx])
			
			// Remove selected from pool
			pool = append(pool[:selectedIdx], pool[selectedIdx+1:]...)
		}
	}

	return finalOrder
}

// weightedSelectIndex selects an index from routes based on their Weight
func weightedSelectIndex(routes []models.ModelRoute) int {
	totalWeight := 0
	for _, r := range routes {
		w := r.Weight
		if w <= 0 { w = 1 } // Ensure at least 1
		totalWeight += w
	}

	if totalWeight == 0 {
		return rand.Intn(len(routes))
	}

	r := rand.Intn(totalWeight)
	currentWeight := 0
	for i, route := range routes {
		w := route.Weight
		if w <= 0 { w = 1 }
		currentWeight += w
		if r < currentWeight {
			return i
		}
	}
	
	return len(routes) - 1 // Should not happen
}

func (r *Router) getProviderInstance(p *models.Provider) (provider.Provider, error) {
	// Check cache
	if val, ok := r.providerCache.Load(p.ID); ok {
		return val.(provider.Provider), nil
	}

	// Create new instance
	prov, err := factory.NewProvider(p)
	if err != nil {
		return nil, err
	}

	// Store in cache
	r.providerCache.Store(p.ID, prov)
	return prov, nil
}
