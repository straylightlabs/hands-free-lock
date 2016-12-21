//
//  LockViewController.swift
//  StraylightLockApp
//
//  Created by Ryo Kawaguchi on 2016/12/20.
//  Copyright © 2016 Straylight. All rights reserved.
//

import UIKit
import HomeKit

class LockViewController: UIViewController, HMHomeManagerDelegate, HMAccessoryDelegate {

    // TODO(ryok): Move the lock mechanism to a separate LockManager singleton class.
    static weak var singleton: LockViewController?

    @IBOutlet weak var lockButton: UIButton!
    @IBOutlet weak var activityIndicator: UIActivityIndicatorView!

    private let homeManager = HMHomeManager()
    private var targetLockState: HMCharacteristic?
    private var isLocked = false
    private var isUpdatingLockState = true {
        didSet {
            lockButton.isHidden = isUpdatingLockState
            activityIndicator.isHidden = !isUpdatingLockState
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        self.homeManager.delegate = self
        self.isUpdatingLockState = true
        self.lockButton.addTarget(self, action: #selector(didTouchLockButton), for: .touchDown)
        self.activityIndicator.startAnimating()

        LockViewController.singleton = self
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
                                    self.updateStateWith(characteristic)
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

    func updateLockState(_ shouldLock: Bool) {
        print("INFO: Updating the lock state: \(shouldLock ? "LOCKED" : "UNLOCKED").")

        if self.isUpdatingLockState || self.isLocked == shouldLock {
            return
        }
        self.isUpdatingLockState = true
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

    func accessoryDidUpdateReachability(_ accessory: HMAccessory) {
        print("INFO: The lock became \(accessory.isReachable ? "reachable" : "not reachable").")
    }

    func accessory(_ accessory: HMAccessory, service: HMService, didUpdateValueFor characteristic: HMCharacteristic) {
        if characteristic.characteristicType == HMCharacteristicTypeCurrentLockMechanismState {
            self.updateStateWith(characteristic)
        }
    }

    func didTouchLockButton(sender: UIButton) {
        // isEnabled does not update the button state properly...
        self.updateLockState(!self.isLocked)
    }

    private func updateStateWith(_ characteristic: HMCharacteristic) {
        self.isLocked = characteristic.value as? Int == 1
        self.lockButton.isSelected = !self.isLocked
        self.isUpdatingLockState = false

        print("INFO: Lock state updated: \(self.isLocked ? "LOCKED" : "UNLOCKED").")
    }

}
