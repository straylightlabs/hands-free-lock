#!/bin/bash

./text_display 'PLACE & HOLD'

{ ./ble_scanner.py & ./nfc_scanner.py; } | while IFS= read -r line; do
  print $line
  ./text_display 'SCANNED'
  curl 192.168.0.3:8080/unlock
  sleep 10
  ./text_display 'PLACE & HOLD'
done

