package router

import (
	"fmt"
	"sort"
	"sync"
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

	// 2. Sort Routes based on Preference
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
	case "lowest_latency":
		// TODO: Implement real latency tracking. 
		// For now, use Priority as a proxy for "Quality/Speed" if explicitly set, 
		// or maybe random to load balance if priorities are equal?
		// Let's stick to Priority DESC for now as a proxy for "Best Available"
		sort.Slice(routes, func(i, j int) bool {
			return routes[i].Priority > routes[j].Priority
		})
	default: // "priority" or empty
		// Sort by Priority Descending
		sort.Slice(routes, func(i, j int) bool {
			return routes[i].Priority > routes[j].Priority
		})
	}

	// 3. Build Result List (Candidates for Fallback)
	var results []*RouteResult
	for i := range routes {
		// Get or Create Provider Instance
		prov, err := r.getProviderInstance(&routes[i].Provider)
		if err != nil {
			// Log error but skip this provider? 
			// For now, let's include it, or maybe return error?
			// If we can't create the provider (e.g. factory error), we should probably skip it.
			fmt.Printf("Error creating provider instance for %s: %v\n", routes[i].Provider.Name, err)
			continue
		}

		results = append(results, &RouteResult{
			Provider:   prov,
			ModelRoute: &routes[i],
		})
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("failed to initialize any providers for model: %s", modelName)
	}

	return results, nil
}

func (r *Router) getProviderInstance(p *models.Provider) (provider.Provider, error) {
	// Check cache
	if val, ok := r.providerCache.Load(p.ID); ok {
		return val.(provider.Provider), nil
	}

	// Create new
	prov, err := factory.NewProvider(p)
	if err != nil {
		return nil, err
	}

	// Cache it
	r.providerCache.Store(p.ID, prov)
	return prov, nil
}
