//
//  LockHttpServer.swift
//  StraylightLockApp
//
//  Created by Ryo Kawaguchi on 2017/01/09.
//  Copyright © 2017 Straylight. All rights reserved.
//

import Foundation
import Swifter

class LockHttpServer {
    private let server = HttpServer()

    init(lockVC: LockViewController) {
        server["/lock"] = { _ in
            lockVC.updateLockState(true)
            return HttpResponse.ok(.text("OK"))
        }
        server["/unlock"] = { _ in
            lockVC.updateLockState(false)
            return HttpResponse.ok(.text("OK"))
        }
        server["/status"] = { _ in
            return HttpResponse.ok(.text(lockVC.isLocked ? "LOCKED" : "UNLOCKED"))
        }

        try! server.start()
        print("Server listening on port \(try! server.port()).")
    }
}
