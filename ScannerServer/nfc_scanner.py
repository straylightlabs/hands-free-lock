import signal
import time

from pirc522 import RFID

loop = True
rfid = RFID()

def end_read(signal, frame):
    global loop
    print("\nCtrl+C captured, ending read.")
    loop = False
    rfid.cleanup()

signal.signal(signal.SIGINT, end_read)

print("Scanning...")

while loop:
    (not_found, data) = rfid.request()
    if not_found:
        continue

    (error, uid) = rfid.anticoll()
    if error:
        print(error)
        continue

    rfid.select_tag(uid)
    data = list(rfid.read(4)[-4:])
    done_reading = False
    for i in xrange(2, 16):
        for c in rfid.read(i * 4):
            if c == 0:
                done_reading = True
                break
            data.append(c)
        if done_reading:
            break
        
    print(''.join([chr(c) for c in data]))
    time.sleep(5)

