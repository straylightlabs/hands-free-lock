#!/usr/bin/env python

import sys

import Adafruit_SSD1306

from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont

# Raspberry Pi pin configuration:
RST = 24

# 128x64 display with hardware I2C:
disp = Adafruit_SSD1306.SSD1306_128_64(rst=RST)

# Init and clear display.
disp.begin()
disp.clear()
disp.display()

# Create blank image for drawing.
# Make sure to create image with mode '1' for 1-bit color.
width = disp.width
height = disp.height
image = Image.new('1', (width, height))
draw = ImageDraw.Draw(image)

# Draw a black filled box to clear the image.
draw.rectangle((0,0,width,height), outline=0, fill=0)

# Draw a line of text.
text = ' '.join(sys.argv[1:])
font = ImageFont.truetype('Arial.ttf', 28)
draw.text((0, 0), text, font=font, fill=255)
disp.image(image)
disp.display()

