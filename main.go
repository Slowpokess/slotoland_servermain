package main

import (
	"os"

	"github.com/slotopol/server/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
