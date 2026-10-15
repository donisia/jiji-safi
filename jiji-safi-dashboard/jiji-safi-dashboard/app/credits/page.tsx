"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  getMockCredits, 
  getMockReports, 
  Credit, 
  Report, 
  reporterLeaderboard, 
  ZONES 
} from "@/lib/data";
import { 
  Award, 
  Trophy, 
  ShieldAlert, 
  Gift, 
  CheckCircle, 
  AlertTriangle, 
  Flame, 
  TrendingUp, 
  UserCheck, 
  Plus, 
  Sparkles,
  Phone,
  Coins
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("October 2026");
  const [flaggedReporters, setFlaggedReporters] = useState<Record<string, number>>({});
  const [awardingTo, setAwardingTo] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(20);
  const [customReason, setCustomReason] = useState("Verified 3-day clean stall streak");

  useEffect(() => {
    setCredits(getMockCredits());
    setReports(getMockReports());
  }, []);

  const leaderboard = useMemo(() => {
    return reporterLeaderboard(credits);
  }, [credits]);

  // False reports count per reporter
  const falseReportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => {
      if (r.status === "flagged") {
        counts[r.reporter_id] = (counts[r.reporter_id] || 0) + 1;
      }
    });
    return counts;
  }, [reports]);

  // Issue credit handler
  const handleIssueCredit = (reporterId: string, reporterName: string) => {
    const newCredit: Credit = {
      id: Date.now(),
      ts: new Date().toISOString(),
      reporter_id: reporterId,
      reporter_name: reporterName,
      zone: "Ngong",
      amount: customAmount,
      reason: customReason,
    };
    setCredits([newCredit, ...credits]);
    setAwardingTo(null);
  };

  // Flag or penalize reporter
  const handlePenalize = (reporterId: string) => {
    setFlaggedReporters((prev) => ({
      ...prev,
      [reporterId]: (prev[reporterId] || 0) + 1,
    }));
  };

  const totalPointsDistributed = credits.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            Citizen Credits, Vendor Incentives & Fraud Verification
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Reward vendors maintaining clean zones, distribute monthly vouchers, and audit contradictory reports
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
          <Gift className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Monthly Cycle:</span>
          <span className="font-bold text-white">{selectedMonth}</span>
        </div>
      </div>

      {/* Monthly Rewards Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
              Sector of the Month
            </span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-white">
            Kiserian Market Ward
          </div>
          <p className="text-xs text-slate-300 mt-1">
            +74% clearance rate improvement and 0 drain clogs reported for 14 days straight.
          </p>
          <div className="mt-3 text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            Ksh 25,000 Community Dustbin Fund Awarded
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
              Top Vendor Champion
            </span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white">
            {leaderboard[0]?.name ?? "Wanjiku M."}
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Logged 18 verified clean-up alerts near Ngong Bus Park without a single false report.
          </p>
          <div className="mt-3 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" />
            Redeemable Airtime / Stall Fee Rebate Token
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Total Safi Points Pool
              </span>
              <Coins className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-black text-white">
              {totalPointsDistributed.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Distributed across {leaderboard.length} active vendors & community reporters
            </p>
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">
            10 Points = 1 Verified 3-Day Clean Streak
          </div>
        </div>
      </div>

      {/* Main Grid: Leaderboard (Left) + False Report Audit (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reporter Leaderboard */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Reporter Standing & Credit Balances
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Eligible for County Airtime / Cash Rebates
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Rank</th>
                  <th className="p-3.5">Citizen / Vendor</th>
                  <th className="p-3.5">Valid Reports</th>
                  <th className="p-3.5">Points Earned</th>
                  <th className="p-3.5">Trust Score</th>
                  <th className="p-3.5 text-right">Award Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {leaderboard.map((user, idx) => {
                  const falseReports = falseReportCounts[user.reporter_id] || 0;
                  const isFlagged = (flaggedReporters[user.reporter_id] || 0) > 0;
                  const trustScore = Math.max(0, 100 - falseReports * 25);

                  return (
                    <tr
                      key={user.reporter_id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isFlagged ? "bg-rose-950/20" : ""
                      }`}
                    >
                      <td className="p-3.5 font-bold font-mono text-slate-400">
                        {idx === 0 ? (
                          <span className="text-amber-400 text-sm">🥇 #1</span>
                        ) : idx === 1 ? (
                          <span className="text-slate-300 text-sm">🥈 #2</span>
                        ) : idx === 2 ? (
                          <span className="text-amber-600 text-sm">🥉 #3</span>
                        ) : (
                          `#${idx + 1}`
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-white">
                          {user.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {user.reporter_id}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-300 font-mono">
                        {user.count} clean logs
                      </td>

                      <td className="p-3.5 font-mono">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">
                          {user.total} pts
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono text-xs font-bold ${
                              trustScore >= 80
                                ? "text-emerald-400"
                                : trustScore >= 50
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            {trustScore}%
                          </span>
                          {falseReports > 0 && (
                            <span className="text-[10px] text-rose-400">
                              ({falseReports} false)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setAwardingTo(user.reporter_id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 text-[11px] font-semibold border border-emerald-500/30 transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Reward
                          </button>
                          <button
                            onClick={() => handlePenalize(user.reporter_id)}
                            title="Flag reporter for contradictory logs"
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fraud Verification & Contradiction Flagging */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Contradiction & Spam Audit
              </h2>
            </div>
            <span className="text-xs text-rose-400 font-mono">
              Anti-Gaming Rules
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Vendors earn redeemable points by logging 3 consecutive clean days. To prevent falsified claims, reports are cross-checked with:
            </p>

            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-white block text-[11px]">
                    Gemini Vision Photo Cross-Verification
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    Validates clean stall vs dirty background before awarding.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-white block text-[11px]">
                    Contradictory Citizen Logs
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    If a citizen reports a blocked drain at the same GPS point within 4 hours, credit claim is flagged for inspector review.
                  </span>
                </div>
              </div>
            </div>

            {/* Recent flagged audit list */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 font-mono">
                Flagged Incidents Under Review:
              </span>
              <div className="space-y-1.5">
                {reports
                  .filter((r) => r.status === "flagged")
                  .slice(0, 4)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/20 text-[11px]"
                    >
                      <div className="flex justify-between font-bold text-white">
                        <span>#{r.id} • {r.zone}</span>
                        <span className="text-rose-400">Suspicious</span>
                      </div>
                      <p className="text-slate-400 text-[10px] mt-0.5 truncate">
                        "{r.details}"
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reward Modal / Drawer */}
      {awardingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Gift className="w-4 h-4" />
                <span>Issue Citizen Credits</span>
              </div>
              <button
                onClick={() => setAwardingTo(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Manually reward reporter <strong>{awardingTo}</strong> for verified community sanitation work.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Credit Points Amount
              </label>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Reason / Clean Streak Verification
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setAwardingTo(null)}
                className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleIssueCredit(awardingTo, "Vendor Champion")}
                className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Confirm +{customAmount} Pts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
