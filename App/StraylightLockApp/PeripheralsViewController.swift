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

    struct MyScannedPeripheral {
        var peripheral: Peripheral
        var rssi: Decimal
        var lastDiscoveryTime: Date

        init(_ peripheral: ScannedPeripheral) {
            self.peripheral = peripheral.peripheral
            self.rssi = peripheral.rssi.decimalValue
            self.lastDiscoveryTime = Date()
        }
    }

    @IBOutlet weak var tableView: UITableView!

    // TODO(ryok): Support state restoration.
    private let bluetoothManager = BluetoothManager(queue: .main)
    private let disposeBag = DisposeBag()
    private var lastUnlockTime = Date()
    fileprivate var scannedPeripherals: [MyScannedPeripheral] = []
    fileprivate var registeredUUIDs = Set<String>([
        "AD315288-C4D2-FDCC-CE86-4C5A687B5FB9"  // Ryo's Tile
    ])
    fileprivate let cellId = "PeripheralTableCell"
    private let timeUntilLock = 30.0
    private let minRSSIToAuthorize: Decimal = -95.0
    private let scanDuration = 15.0
    private var scanTime = Date()

    override func viewDidLoad() {
        super.viewDidLoad()

        self.tableView.delegate = self
        self.tableView.dataSource = self
        self.tableView.estimatedRowHeight = 63.0
        self.tableView.rowHeight = UITableViewAutomaticDimension

        let timerQueue = DispatchQueue(label: "jp.straylight.StraylightLockApp")
        let scheduler = ConcurrentDispatchQueueScheduler(queue: timerQueue)

        self.scanTime = Date()
        self.lastUnlockTime = Date()

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

        Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            if let strongSelf = self {
                strongSelf.updateAutorization()
            }
        }
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }

    private func processPeripheral(_ peripheral: ScannedPeripheral) {
        let scannedPeripheral = MyScannedPeripheral(peripheral)
        self.authorize(scannedPeripheral)

        let mapped = scannedPeripherals.map { $0.peripheral }
        if let index = mapped.index(of: peripheral.peripheral) {
            self.scannedPeripherals[index] = scannedPeripheral
        // TODO(ryok): Add a UI control for scanning.
        } else if Date().timeIntervalSince(self.scanTime) < self.scanDuration {
            self.scannedPeripherals.append(scannedPeripheral)
            self.connectPeripheral(peripheral.peripheral)
        }
        self.tableView.reloadData()
    }

    private func connectPeripheral(_ peripheral: Peripheral) {
        self.bluetoothManager.connect(peripheral)
            .subscribe(onNext: { _ in
                print("INFO: Found \(peripheral.name ?? "an unknown device") [\(peripheral.identifier.uuidString)].")
                self.tableView.reloadData()
            }, onError: { error in
                print("ERROR: Failed to connect to device[\(peripheral.identifier.uuidString)]. error=\(error)")
            })
            .addDisposableTo(self.disposeBag)
    }

    private func authorize(_ peripheral: MyScannedPeripheral) {
        let uuid = peripheral.peripheral.identifier.uuidString
        if self.registeredUUIDs.contains(uuid) {
            print("DEBUG: Discovery RSSI=\(peripheral.rssi) UUID=\(uuid).")
            if self.minRSSIToAuthorize < peripheral.rssi && peripheral.rssi < 0 {
                self.lastUnlockTime = Date()
                self.updateAutorization()
            }
        }
    }

    private func updateAutorization() {
        if let lockVC = LockViewController.singleton {
            let shouldUnlock = Date().timeIntervalSince(self.lastUnlockTime) < self.timeUntilLock
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

    func didSwitchRegister(peripheral: Peripheral, on: Bool) {
        let uuid = peripheral.identifier.uuidString
        if on {
            print("INFO: Registered [\(uuid)].")
            self.registeredUUIDs.insert(uuid)
        } else {
            print("INFO: Unregistered [\(uuid)].")
            self.registeredUUIDs.remove(uuid)
        }
    }

}
