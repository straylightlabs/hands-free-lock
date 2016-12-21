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
    func didSwitchRegister(uuid: String, on: Bool) -> Void
}

class PeripheralTableViewCell: UITableViewCell {

    var delegate: PeripheralTableViewCellDelegate?

    @IBOutlet weak var registerSwitch: UISwitch!
    @IBOutlet weak var nameLabel: UILabel!
    @IBOutlet weak var rssiLabel: UILabel!
    @IBOutlet weak var uuidLabel: UILabel!

    func updateWith(_ peripheral: ScannedPeripheral, registered: Bool) {
        self.nameLabel.text = peripheral.peripheral.name ?? "Unknown device"
        self.rssiLabel.text = peripheral.rssi.stringValue
        self.uuidLabel.text = peripheral.peripheral.identifier.uuidString
        self.registerSwitch.isOn = registered
        self.registerSwitch.addTarget(self, action: #selector(didSwitchRegister), for: .valueChanged)
    }

    func didSwitchRegister(sender: UISwitch) {
        if let delegate = self.delegate {
            delegate.didSwitchRegister(uuid: self.uuidLabel.text!, on: sender.isOn)
        }
    }

}
