//
//  LockHttpServer.swift
//  StraylightLockApp
//
//  Created by Ryo Kawaguchi on 2017/01/09.
//  Copyright © 2017 Straylight. All rights reserved.
//

import Foundation
import Swifter

protocol LockHttpServerDelegate {
    var isLocked: Bool { get }
    func updateLockState(_ shouldLock: Bool)
}

class LockHttpServer {
    var delegate: LockHttpServerDelegate?

    private let server = HttpServer()

    init() {
        server["/lock"] = { _ in
            DispatchQueue.main.async {
                if let delegate = self.delegate {
                    delegate.updateLockState(true)
                }
            }
            return HttpResponse.ok(.text("OK"))
        }
        server["/unlock"] = { _ in
            DispatchQueue.main.async {
                if let delegate = self.delegate {
                    delegate.updateLockState(false)
                }
            }
            return HttpResponse.ok(.text("OK"))
        }
        server["/status"] = { _ in
            return HttpResponse.ok(.text(
                self.delegate == nil ? "UNKNOWN" :
                    self.delegate!.isLocked ? "LOCKED" : "UNLOCKED"))
        }

        try! server.start()
        print("Server listening on port \(try! server.port()).")
    }
}
