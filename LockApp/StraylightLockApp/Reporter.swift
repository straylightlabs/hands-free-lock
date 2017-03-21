//
//  Reporter.swift
//  StraylightLockApp
//
//  Created by Ryo Kawaguchi on 2017/03/22.
//  Copyright © 2017 Straylight. All rights reserved.
//

import Foundation

class Reporter {

    private static let REPORT_URL = URL(string: "http://192.168.0.5:8080/report")!

    public func reportLockState(_ state: String) {
        let data = try! JSONSerialization.data(withJSONObject: ["type": "lockStateChange", "state": state])
        self.report(data: data)
    }

    private func report(data: Data) {
        var request = URLRequest(url: Reporter.REPORT_URL)
        request.httpMethod = "POST"
        request.httpBody = data
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
