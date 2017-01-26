//
//  ViewController.swift
//  LockApp
//
//  Created by Ryo Kawaguchi on 2017/01/09.
//  Copyright © 2017 Straylight. All rights reserved.
//

import UIKit
import HomeKit
import Toaster

class LockViewController: UIViewController, LockHttpServerDelegate, HMHomeManagerDelegate, HMAccessoryDelegate {

    var isLocked = false {
        didSet {
            self.updateLockButtonImages()
        }
    }

    @IBOutlet weak var lockButton: UIButton!
    @IBOutlet weak var delayLockButton: UIButton!
    @IBOutlet weak var keepConnectionSwitch: UISwitch!

    private var server = LockHttpServer()
    private let homeManager = HMHomeManager()
    private var targetLockState: HMCharacteristic?
    private var countDownTimer: Timer?
    private var keepConnectionTimer: Timer?
    private var countDownSec = COUNT_DOWN_TOTAL_SEC
    private var isUpdatingLockState = false {
        didSet {
            self.updateLockButtonImages()
        }
    }

    private static let REPORT_URL = URL(string: "http://192.168.0.5:8080/report")!
    private static let COUNT_DOWN_TOTAL_SEC = 20

    override func viewDidLoad() {
        super.viewDidLoad()

        self.server.delegate = self
        self.homeManager.delegate = self

        self.lockButton.addTarget(self, action: #selector(didTouchLockButton), for: .touchDown)
        self.delayLockButton.addTarget(self, action: #selector(didTouchDelayLockButton), for: .touchDown)
        self.keepConnectionSwitch.addTarget(self, action: #selector(didTouchKeepConnectionSwitch), for: .valueChanged)
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }

    func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        var foundLock = false
        if let home = self.homeManager.primaryHome {
            for service in home.servicesWithTypes([HMServiceTypeLockMechanism])! {
                if let accessary = service.accessory {
                    if foundLock {
                        print("WARNING: found more than one locks.")
                        return
                    }
                    accessary.delegate = self
                    foundLock = true

                    for characteristic in service.characteristics {
                        if characteristic.characteristicType == HMCharacteristicTypeTargetLockMechanismState {
                            self.targetLockState = characteristic
                        } else if characteristic.characteristicType == HMCharacteristicTypeCurrentLockMechanismState {
                            characteristic.readValue { error in
                                if error == nil {
                                    self.didUpdateStateWith(characteristic)
                                } else {
                                    print("ERROR: Failed to read the lock state.")
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    func accessoryDidUpdateReachability(_ accessory: HMAccessory) {
        print("INFO: The lock became \(accessory.isReachable ? "reachable" : "not reachable").")

        if accessory.isReachable {
            self.updateLockButtonImages()
        } else {
            lockButton.setImage(#imageLiteral(resourceName: "DisconnectedButton"), for: .normal)
            delayLockButton.isHidden = true
        }
    }

    func accessory(_ accessory: HMAccessory, service: HMService, didUpdateValueFor characteristic: HMCharacteristic) {
        if characteristic.characteristicType == HMCharacteristicTypeCurrentLockMechanismState {
            self.didUpdateStateWith(characteristic)
        }
    }

    func didTouchLockButton(sender: UIButton) {
        self.updateLockState(!self.isLocked)
    }

    func didTouchDelayLockButton(sender: UIButton) {
        precondition(!self.isLocked)

        self.countDownTimer = Timer.scheduledTimer(timeInterval: 1.0, target: self, selector: #selector(countDownToLock), userInfo: nil, repeats: true)
        self.updateLockButtonImages()
    }

    func didTouchKeepConnectionSwitch(sender: UISwitch) {
        self.keepConnectionSwitch.isOn = !self.keepConnectionSwitch.isOn
        if self.keepConnectionSwitch.isOn {
            self.keepConnectionTimer = Timer.scheduledTimer(timeInterval: 2.0, target: self, selector: #selector(connectToTargetState), userInfo: nil, repeats: true)
        } else {
            self.keepConnectionTimer?.invalidate()
        }
    }

    func countDownToLock() {
        precondition(self.countDownTimer != nil)

        self.countDownSec -= 1
        self.updateLockButtonImages()

        if (self.countDownSec <= 0) {
            self.updateLockState(true)
            self.countDownTimer?.invalidate()
            self.countDownTimer = nil
            self.countDownSec = LockViewController.COUNT_DOWN_TOTAL_SEC
        }
    }

    func updateLockState(_ shouldLock: Bool) {
        if self.isUpdatingLockState {
            print("The lock is being updated.")
            return
        }
        if self.isLocked == shouldLock {
            print("No need to update the lock state.")
            return
        }

        self.keepConnectionTimer?.invalidate()
        self.keepConnectionSwitch.isOn = false

        self.isUpdatingLockState = true
        print("INFO: Updating the lock state: \(shouldLock ? "LOCKED" : "UNLOCKED").")

        if let state = self.targetLockState {
            state.writeValue(shouldLock ? 1 : 0) { error in
                if error != nil {
                    print("ERROR: Failed to update the lock state: \(error).")
                }
            }
        } else {
            print("ERROR: Lock not found.")
        }
    }

    func connectToTargetState() {
        self.targetLockState?.readValue { error in
            if error != nil {
                print("ERROR: Failed to read the lock state.")
            }
        }
    }

    private func didUpdateStateWith(_ characteristic: HMCharacteristic) {
        self.isLocked = characteristic.value as? Int == 1
        self.isUpdatingLockState = false
        self.updateLockButtonImages()

        self.reportLockStateChange()

        print("INFO: Lock state updated: \(self.isLocked ? "LOCKED" : "UNLOCKED").")
    }

    private func updateLockButtonImages() {
        self.lockButton.setImage(self.isLocked ? #imageLiteral(resourceName: "LockButton") : #imageLiteral(resourceName: "UnlockButton"), for: .normal)

        self.delayLockButton.setTitle("Lock after \(self.countDownSec) seconds", for: .normal)
        self.delayLockButton.isHidden = self.isLocked || self.isUpdatingLockState
        self.delayLockButton.isEnabled = self.countDownTimer == nil

        if isUpdatingLockState {
            UIView.animate(withDuration: 0.6) {
                self.lockButton.transform = CGAffineTransform(scaleX: 0.001, y: 0.001)
            }
        } else if self.countDownTimer != nil {
            UIView.animate(withDuration: 0.5, delay: 0.0, options: [.repeat, .curveEaseOut, .autoreverse], animations: {
                self.lockButton.transform = CGAffineTransform(scaleX: 0.8, y: 0.8)
            }, completion: nil)
        } else {
            self.lockButton.transform = CGAffineTransform.identity
        }
    }

    private func reportLockStateChange() {
        var request = URLRequest(url: LockViewController.REPORT_URL)
        request.httpMethod = "POST"
        request.httpBody = try! JSONSerialization.data(withJSONObject: ["type": "lockStateChange", "locked": self.isLocked])
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            guard let data = data, error == nil else {
                print("ERROR: Failed to post: \(error)")
                return
            }
            if let httpStatus = response as? HTTPURLResponse, httpStatus.statusCode != 200 {
                print("ERROR: statusCode=\(httpStatus.statusCode)")
            }
            let responseString = String(data: data, encoding: .utf8)
            if responseString != "OK" {
                print("ERROR: Unexpected response: \(responseString)")
            }
        }
        task.resume()
    }

}
