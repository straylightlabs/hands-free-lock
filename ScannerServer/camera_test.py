#!/usr/bin/python

from picamera import PiCamera
from time import sleep

camera = PiCamera()

while True:
  camera.capture('/tmp/camera.jpg')
  sleep(1)
  
