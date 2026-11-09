'use client';

import React from 'react';
import { FileText, CheckCircle2, Clock } from 'lucide-react';
import { ReferredInvestorSummary } from '@/utils/referralCalculations';
import { PrivacyMaskedAmount } from '@/components/common/PrivacyMaskedAmount';
import { PrivacyMaskedText } from '@/components/common/PrivacyMaskedText';

interface ReferralContractBreakdownRowProps {
  summary: ReferredInvestorSummary;
  referrerName: string;
  colSpan?: number;
}

export const ReferralContractBreakdownRow: React.FC<ReferralContractBreakdownRowProps> = ({
  summary,
  referrerName,
  colSpan = 10,
}) => {
  if (summary.contracts.length === 0) {
    return (
      <tr className="bg-slate-950/90">
        <td colSpan={colSpan} className="py-3 px-6 text-center text-xs text-slate-500">
          لا توجد عقود تقسيط مسجلة لهذا المستثمر حتى الآن.
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-slate-950/95 border-b border-slate-800/80">
      <td colSpan={colSpan} className="p-3 sm:p-4">
        <div className="rounded-2xl border border-purple-500/25 bg-slate-900/70 overflow-hidden shadow-inner">
          {/* Sub-header */}
          <div className="px-4 py-2.5 bg-purple-950/25 border-b border-purple-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-purple-200">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>تفصيل أرباح عقود المستثمر ({summary.investorName}) وتوزيع الحصص لكل عقد:</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                حصة {summary.investorName}: {summary.investorSharePercent}%
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25">
                حصة الشركة: {summary.grossCompanySharePercent}%
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25">
                عمولة {referrerName}: {summary.referrerSharePercent}% من ربح الشركة
              </span>
            </div>
          </div>

          {/* Contracts Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px]">
              <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800/80 font-semibold">
                <tr>
                  <th className="py-2 px-3 text-center w-8">#</th>
                  <th className="py-2 px-3">رقم العقد والزبون</th>
                  <th className="py-2 px-3">المادة (الشراء ← البيع)</th>
                  <th className="py-2 px-3 text-center">الأقساط المسددة</th>
                  <th className="py-2 px-3 text-left">ربح العقد الكلي (100%)</th>
                  <th className="py-2 px-3 text-left">حصة المستثمر ({summary.investorSharePercent}%)</th>
                  <th className="py-2 px-3 text-left">عمولة الوسيط ({summary.referrerSharePercent}% من الشركة)</th>
                  <th className="py-2 px-3 text-left">صافي ربح الشركة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {summary.contracts.map((cnt, i) => {
                  const isFullyPaid = cnt.paidMonths >= cnt.totalMonths && cnt.totalMonths > 0;
                  return (
                    <tr key={cnt.contractId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-bold">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-amber-300">{cnt.contractNumber}</div>
                        <div className="text-slate-300 text-[10.5px]">
                          الزبون:{' '}
                          <PrivacyMaskedText
                            id={`ref-cnt-borr-${cnt.contractId}`}
                            text={cnt.borrowerName}
                            size="xs"
                            className="text-slate-200 font-semibold"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-200 font-semibold truncate max-w-[180px]">{cnt.itemName}</div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 flex-wrap">
                          <PrivacyMaskedAmount
                            id={`ref-cnt-cost-${cnt.contractId}`}
                            value={cnt.itemCostPriceIQD}
                            size="xs"
                            hideIcon
                            className="text-slate-400"
                          />
                          <span>←</span>
                          <PrivacyMaskedAmount
                            id={`ref-cnt-sale-${cnt.contractId}`}
                            value={cnt.totalSalePriceIQD}
                            size="xs"
                            hideIcon
                            className="text-slate-300"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            isFullyPaid
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isFullyPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>
                            {cnt.paidMonths} / {cnt.totalMonths} مسدد
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono">
                        <div className="font-bold text-white">
                          <PrivacyMaskedAmount
                            id={`ref-cnt-totprof-${cnt.contractId}`}
                            value={cnt.collectedContractProfitIQD}
                            label={`ربح محصل للعقد ${cnt.contractNumber}`}
                            size="xs"
                            className="text-white"
                          />
                        </div>
                        {cnt.collectedContractProfitIQD < cnt.totalContractProfitIQD && (
                          <div className="text-[10px] text-slate-400">
                            من أصل{' '}
                            <PrivacyMaskedAmount
                              id={`ref-cnt-origprof-${cnt.contractId}`}
                              value={cnt.totalContractProfitIQD}
                              size="xs"
                              hideIcon
                              className="text-slate-400"
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-400">
                        <span>+</span>
                        <PrivacyMaskedAmount
                          id={`ref-cnt-invprof-${cnt.contractId}`}
                          value={cnt.collectedInvestorProfitIQD}
                          label={`حصة المستثمر من العقد ${cnt.contractNumber}`}
                          size="xs"
                          className="text-emerald-400"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono">
                        <div className="font-bold text-purple-300">
                          <span>+</span>
                          <PrivacyMaskedAmount
                            id={`ref-cnt-refprof-${cnt.contractId}`}
                            value={cnt.collectedReferrerProfitIQD}
                            label={`عمولة الوسيط المستلمة من العقد ${cnt.contractNumber}`}
                            size="xs"
                            className="text-purple-300"
                          />
                        </div>
                        {cnt.remainingReferrerProfitIQD > 0 && (
                          <div className="text-[10px] text-amber-400/90">
                            متبقي:{' '}
                            <PrivacyMaskedAmount
                              id={`ref-cnt-remref-${cnt.contractId}`}
                              value={cnt.remainingReferrerProfitIQD}
                              size="xs"
                              hideIcon
                              className="text-amber-400"
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono font-bold text-blue-400">
                        <span>+</span>
                        <PrivacyMaskedAmount
                          id={`ref-cnt-compprof-${cnt.contractId}`}
                          value={cnt.collectedCompanyProfitIQD}
                          label={`صافي الشركة من العقد ${cnt.contractNumber}`}
                          size="xs"
                          className="text-blue-400"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-950 border-t border-slate-800 font-bold text-xs">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-slate-300">
                    مجموع عقود المستثمر ({summary.contractsCount} عقد)
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                    {summary.totalPaidInstallments} / {summary.totalInstallments} قسط مسدد
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono text-white">
                    <PrivacyMaskedAmount
                      id={`ref-sum-totprof-${summary.investorId}`}
                      value={summary.collectedContractProfitIQD}
                      size="xs"
                      className="text-white font-black"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono text-emerald-400">
                    <span>+</span>
                    <PrivacyMaskedAmount
                      id={`ref-sum-invprof-${summary.investorId}`}
                      value={summary.collectedInvestorProfitIQD}
                      size="xs"
                      className="text-emerald-400 font-black"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono text-purple-300">
                    <span>+</span>
                    <PrivacyMaskedAmount
                      id={`ref-sum-refprof-${summary.investorId}`}
                      value={summary.collectedReferrerProfitIQD}
                      size="xs"
                      className="text-purple-300 font-black"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono text-blue-400">
                    <span>+</span>
                    <PrivacyMaskedAmount
                      id={`ref-sum-compprof-${summary.investorId}`}
                      value={summary.collectedCompanyProfitIQD}
                      size="xs"
                      className="text-blue-400 font-black"
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
};

