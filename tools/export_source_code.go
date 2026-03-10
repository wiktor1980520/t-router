//go:build tools

package main

import (
	"bufio"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Config holds the configuration for source code extraction
type Config struct {
	SourceDir   string
	OutputFile  string
	Extensions  []string
	IgnoreDirs  []string
	RemoveEmpty bool
}

func main() {
	output := flag.String("output", "docs/copyright/source_code.txt", "Output file path")
	flag.Parse()

	config := Config{
		SourceDir:  ".",
		OutputFile: *output,
		Extensions: []string{".go", ".tsx", ".ts", ".css", ".html", ".sql"},
		IgnoreDirs: []string{
			"node_modules", "vendor", ".git", "dist", "build", "out", 
			"bin", ".idea", ".vscode", "tmp", "temp", "coverage",
		},
		RemoveEmpty: true,
	}

	if err := extractSourceCode(config); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Successfully exported source code to %s\n", config.OutputFile)
}

func extractSourceCode(config Config) error {
	outFile, err := os.Create(config.OutputFile)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer outFile.Close()

	writer := bufio.NewWriter(outFile)
	defer writer.Flush()

	lineCount := 0

	err = filepath.WalkDir(config.SourceDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip ignored directories
		if d.IsDir() {
			for _, ignore := range config.IgnoreDirs {
				if d.Name() == ignore {
					return filepath.SkipDir
				}
			}
			// Skip hidden directories starting with .
			if strings.HasPrefix(d.Name(), ".") && d.Name() != "." {
				return filepath.SkipDir
			}
			return nil
		}

		// Filter by extension
		ext := strings.ToLower(filepath.Ext(path))
		validExt := false
		for _, e := range config.Extensions {
			if e == ext {
				validExt = true
				break
			}
		}
		if !validExt {
			return nil
		}

		// Read file content
		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read file %s: %w", path, err)
		}

		// Write header for each file (optional, but good for context)
		// Usually for copyright registration, you just need raw code, but having filename helps review
		// We'll skip filename header to keep it pure code if needed, but let's add a small comment
		// header := fmt.Sprintf("// File: %s\n", path)
		// writer.WriteString(header)

		scanner := bufio.NewScanner(strings.NewReader(string(content)))
		for scanner.Scan() {
			line := scanner.Text()
			trimmed := strings.TrimSpace(line)

			// Skip empty lines if configured
			if config.RemoveEmpty && trimmed == "" {
				continue
			}

			// Write line
			writer.WriteString(line + "\n")
			lineCount++

			// Limit to ~60 pages * 50 lines = 3000 lines? 
			// Actually usually full source code is fine for electronic submission or first/last 30 pages.
			// We will export all for now.
		}

		return nil
	})

	if err != nil {
		return err
	}

	fmt.Printf("Total lines exported: %d\n", lineCount)
	return nil
}
