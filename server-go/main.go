package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"creatures-server/game"
	"creatures-server/ws"
)

func main() {
	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "8089"
	}

	fmt.Println("🚀 Starting Go Grid Creatures Multiplayer Engine...")

	var hubRef *ws.Hub

	// Create Room (World field = 100x100 grid units, halfRadius = 50.0, min 0 bots, max 80 foods)
	room := game.NewRoom(50.0, 0, 80, func(msg game.WSOutputMessage, targetPlayerID string) {
		if hubRef != nil {
			hubRef.BroadcastRoomState(msg, targetPlayerID)
		}
	})

	hub := ws.NewHub(room)
	hubRef = hub

	go hub.Run()
	room.StartLoop()

	mux := http.NewServeMux()

	// WebSocket handler
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, w, r)
	})

	// HTTP API endpoints
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "ok",
			"engine": "Go 1.22 Multiplayer Grid Creatures",
		})
	})

	mux.HandleFunc("/api/presets", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(game.DefaultPresets)
	})

	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "active",
			"port":   port,
		})
	})

	addr := "0.0.0.0:" + port
	log.Printf("🔥 Go Server running on http://%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Go Server error: %v", err)
	}
}
