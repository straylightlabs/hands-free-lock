//
//  PeripheralTableCell.swift
//  StraylightLockApp
//
//  Created by Ryo Kawaguchi on 2016/12/21.
//  Copyright © 2016 Straylight. All rights reserved.
//

import UIKit
import RxBluetoothKit

protocol PeripheralTableViewCellDelegate {
    func didSwitchRegister(peripheral: Peripheral, on: Bool) -> Void
}

class PeripheralTableViewCell: UITableViewCell {

    var peripheral: Peripheral?
    var delegate: PeripheralTableViewCellDelegate?

    @IBOutlet weak var registerSwitch: UISwitch!
    @IBOutlet weak var nameLabel: UILabel!
    @IBOutlet weak var rssiLabel: UILabel!
    @IBOutlet weak var uuidLabel: UILabel!

    func updateWith(_ peripheral: PeripheralsViewController.MyScannedPeripheral, registered: Bool) {
        self.peripheral = peripheral.peripheral
        self.nameLabel.text = peripheral.peripheral.name ?? "Unknown device"
        self.rssiLabel.text = peripheral.rssi == 127 || Date().timeIntervalSince(peripheral.lastDiscoveryTime) > 10.0 ? "" : String(describing: peripheral.rssi)
        self.uuidLabel.text = peripheral.peripheral.identifier.uuidString
        self.registerSwitch.isOn = registered
        self.registerSwitch.addTarget(self, action: #selector(didSwitchRegister), for: .valueChanged)
    }

    func didSwitchRegister(sender: UISwitch) {
        if let delegate = self.delegate {
            delegate.didSwitchRegister(peripheral: self.peripheral!, on: sender.isOn)
        }
    }

}
