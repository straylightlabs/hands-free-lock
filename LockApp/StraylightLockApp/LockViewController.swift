//
//  ViewController.swift
//  LockApp
//
//  Created by Ryo Kawaguchi on 2017/01/09.
//  Copyright © 2017 Straylight. All rights reserved.
//

import UIKit
import HomeKit

class LockViewController: UIViewController, HMHomeManagerDelegate, HMAccessoryDelegate {

    @IBOutlet weak var lockButton: UIButton!

    var isLocked = false

    private let homeManager = HMHomeManager()
    private var targetLockState: HMCharacteristic?
    private var isUpdatingLockState = false {
        didSet {
            if isUpdatingLockState {
                UIView.animate(withDuration: 0.6) {
                    self.lockButton.transform = CGAffineTransform(scaleX: 0.01, y: 0.01)
                }
            } else {
                self.lockButton.transform = CGAffineTransform.identity
            }
        }
    }

    private var server: LockHttpServer?

    override func viewDidLoad() {
        super.viewDidLoad()

        self.homeManager.delegate = self
        self.lockButton.addTarget(self, action: #selector(didTouchLockButton), for: .touchDown)

        self.server = LockHttpServer(lockVC: self)
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

    func accessoryDidUpdateReachability(_ accessory: HMAccessory) {
        print("INFO: The lock became \(accessory.isReachable ? "reachable" : "not reachable").")

        if accessory.isReachable {
            self.updateLockButtonImage()
        } else {
            lockButton.setImage(#imageLiteral(resourceName: "DisconnectedButton"), for: .normal)
        }
    }

    func accessory(_ accessory: HMAccessory, service: HMService, didUpdateValueFor characteristic: HMCharacteristic) {
        if characteristic.characteristicType == HMCharacteristicTypeCurrentLockMechanismState {
            self.updateStateWith(characteristic)
        }
    }

    func didTouchLockButton(sender: UIButton) {
        self.updateLockState(!self.isLocked)
    }

    func updateLockState(_ shouldLock: Bool) {
        if self.isUpdatingLockState || self.isLocked == shouldLock {
            return
        }

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

    private func updateStateWith(_ characteristic: HMCharacteristic) {
        self.isLocked = characteristic.value as? Int == 1
        self.isUpdatingLockState = false
        self.updateLockButtonImage()

        print("INFO: Lock state updated: \(self.isLocked ? "LOCKED" : "UNLOCKED").")
    }

    private func updateLockButtonImage() {
        lockButton.setImage(self.isLocked ? #imageLiteral(resourceName: "LockButton") : #imageLiteral(resourceName: "UnlockButton"), for: .normal)
    }

}
