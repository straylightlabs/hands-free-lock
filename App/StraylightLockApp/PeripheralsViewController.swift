//
//  BeaconsViewController.swift
//  StraylightLockApp
//
//  Created by Ryo Kawaguchi on 2016/12/20.
//  Copyright © 2016 Straylight. All rights reserved.
//

import UIKit
import RxBluetoothKit
import RxSwift
import CoreBluetooth

class PeripheralsViewController: UIViewController {

    @IBOutlet weak var tableView: UITableView!

    // TODO(ryok): Support state restoration.
    private let bluetoothManager = BluetoothManager(queue: .main)
    private let disposeBag = DisposeBag()
    private var lastUnlockTime = Date().timeIntervalSince1970
    fileprivate var scannedPeripherals: [ScannedPeripheral] = []
    fileprivate var registeredUUIDs = Set<String>()
    fileprivate let cellId = "PeripheralTableCell"

    override func viewDidLoad() {
        super.viewDidLoad()

        self.tableView.delegate = self
        self.tableView.dataSource = self
        self.tableView.estimatedRowHeight = 63.0
        self.tableView.rowHeight = UITableViewAutomaticDimension

        let timerQueue = DispatchQueue(label: "jp.straylight.StraylightLockApp")
        let scheduler = ConcurrentDispatchQueueScheduler(queue: timerQueue)

        self.bluetoothManager.rx_state
            .timeout(5.0, scheduler: scheduler)
            .take(1)
            // TODO(ryok): Confirm this is not taking up too much battery power off of BLE beacons.
            .flatMap { _ in self.bluetoothManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]) }
            .subscribeOn(MainScheduler.instance)
            .subscribe(onNext: {
                self.processPeripheral($0)
            }, onError: { error in
                print("ERROR: Failed to scan peripherals. error=\(error)")
            })
            .addDisposableTo(self.disposeBag)

        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            if let strongSelf = self {
                strongSelf.authorize()
            }
        }
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }

    private func processPeripheral(_ peripheral: ScannedPeripheral) {
        let mapped = scannedPeripherals.map { $0.peripheral }
        if let index = mapped.index(of: peripheral.peripheral) {
            self.scannedPeripherals[index] = peripheral
        } else {
            self.scannedPeripherals.append(peripheral)
            self.connectPeripheral(peripheral.peripheral)
        }
        self.tableView.reloadData()
    }

    private func connectPeripheral(_ peripheral: Peripheral) {
        self.bluetoothManager.connect(peripheral)
            .subscribe(onNext: { _ in
                self.tableView.reloadData()
            }, onError: { error in
                let uuid = peripheral.identifier.uuidString
                print("ERROR: Failed to connect to device[\(uuid)]. error=\(error)")
            })
            .addDisposableTo(self.disposeBag)
    }

    fileprivate func authorize() {
        var shouldUnlock = false
        for peripheral in self.scannedPeripherals {
            let uuid = peripheral.peripheral.identifier.uuidString
            if self.registeredUUIDs.contains(uuid) && -80 < peripheral.rssi.decimalValue && peripheral.rssi.decimalValue < 0 {
                shouldUnlock = true
                break
            }
        }

        let now = Date().timeIntervalSince1970
        if shouldUnlock {
            self.lastUnlockTime = now
        } else if now < self.lastUnlockTime + 30 {
            // Lock after 30 seconds of dissappearance.
            shouldUnlock = true
        }

        if let lockVC = LockViewController.singleton {
            lockVC.updateLockState(!shouldUnlock)
        }
    }

}

extension PeripheralsViewController: UITableViewDataSource, UITableViewDelegate {

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return self.scannedPeripherals.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: cellId, for: indexPath)
        let peripheral = self.scannedPeripherals[indexPath.row]
        if let cell = cell as? PeripheralTableViewCell {
            let registered = registeredUUIDs.contains(peripheral.peripheral.identifier.uuidString)
            cell.updateWith(peripheral, registered: registered)
            cell.delegate = self
        }
        return cell
    }

}

extension PeripheralsViewController: PeripheralTableViewCellDelegate {

    func didSwitchRegister(uuid: String, on: Bool) {
        if on {
            print("INFO: Registered [\(uuid)].")
            self.registeredUUIDs.insert(uuid)
        } else {
            print("INFO: Unregistered [\(uuid)].")
            self.registeredUUIDs.remove(uuid)
        }
        self.authorize()
    }

}
