/**
 * FinancialScoreCards.tsx — Financial score cards grid for the Caixa dashboard.
 */

import React from 'react';
import { formatBRL, formatDecimalBRL } from '../utils/format';
import { computeFinancialTotals, computeMonthlyGoalMath } from '../utils/financialCalculations';

interface FinancialScoreCardsProps {
  financialTotals: ReturnType<typeof computeFinancialTotals>;
  monthlyGoalMath: ReturnType<typeof computeMonthlyGoalMath>;
  faturamentoPosDespesas: number;
  activeShift: any;
  excludeSundays: boolean;
  onToggleExcludeSundays: (next: boolean) => void;
}

// ─── Primitivo de card ──────────────────────────────────────────────────────

interface CardProps {
  accent: string;       // CSS color string para a borda esquerda e glow
  glowClass?: string;   // classe .glow-* definida em index.css
  children: React.ReactNode;
}

function ScoreCard({ accent, glowClass = '', children }: CardProps) {
  return (
    <div
      className={`rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-200 ${glowClass}`}
      style={{
        background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.80) 100%)',
        border: '1px solid rgba(51,65,85,0.50)',
        borderLeft: `2px solid ${accent}`,
      }}
    >
      {children}
    </div>
  );
}

function CardLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="text-[10px] font-black uppercase tracking-widest leading-none" style={{ color }}>
      {children}
    </span>
  );
}

function CardValue({ children, color, glowClass = '' }: { children: React.ReactNode; color: string; glowClass?: string }) {
  return (
    <div className={`mt-1.5 text-[18px] font-black font-mono tracking-tight leading-none ${glowClass}`} style={{ color }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-800/60 my-2" />;
}

function Row({ label, value, valueColor = '#94a3b8' }: { label: React.ReactNode; value: React.ReactNode; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center text-[11px] font-mono">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold" style={{ color: valueColor }}>{value}</span>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: color }} />;
}

// ─── Componente principal ───────────────────────────────────────────────────

export function FinancialScoreCards({
  financialTotals,
  monthlyGoalMath,
  faturamentoPosDespesas,
  activeShift,
  excludeSundays,
  onToggleExcludeSundays,
}: FinancialScoreCardsProps) {
  const netPositive = faturamentoPosDespesas >= 0;
  const appBalance = financialTotals.uberBalance + financialTotals.ninetyNineBalance;

  return (
    <div className="grid grid-cols-2 gap-2" id="dashboard-general-scores">

      {/* 1. Faturamento Bruto */}
      <ScoreCard accent="#34d399" glowClass="glow-emerald">
        <CardLabel color="#34d399">Faturamento Bruto</CardLabel>
        <CardValue color="#34d399" glowClass="num-glow-emerald">
          {formatBRL(financialTotals.totalValoresOfertados)}
        </CardValue>
        <Divider />
        <div className="flex flex-col gap-1">
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#e2e8f0" />Uber</span>}
            value={`${financialTotals.uberRidesCount} corr.`}
            valueColor="#e2e8f0"
          />
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#fbbf24" />99 App</span>}
            value={`${financialTotals.ninetyNineRidesCount} corr.`}
            valueColor="#fbbf24"
          />
          {financialTotals.particularRidesCount > 0 && (
            <Row
              label={<span className="flex items-center gap-1"><Dot color="#34d399" />Particular</span>}
              value={`${financialTotals.particularRidesCount} corr.`}
              valueColor="#34d399"
            />
          )}
        </div>
      </ScoreCard>

      {/* 2. Faturamento Pós Despesas */}
      <ScoreCard accent={netPositive ? '#22d3ee' : '#fb7185'} glowClass={netPositive ? 'glow-cyan' : 'glow-rose'}>
        <CardLabel color={netPositive ? '#22d3ee' : '#fb7185'}>Pós Despesas</CardLabel>
        <CardValue color={netPositive ? '#22d3ee' : '#fb7185'} glowClass={netPositive ? 'num-glow-cyan' : 'num-glow-rose'}>
          {formatBRL(faturamentoPosDespesas)}
        </CardValue>
        <Divider />
        <div className="flex flex-col gap-1">
          <Row label="Bruto" value={`R$ ${formatDecimalBRL(financialTotals.totalValoresOfertados)}`} valueColor="#34d399" />
          <Row label="Despesas" value={`-R$ ${formatDecimalBRL(financialTotals.despesasTotais)}`} valueColor="#fb7185" />
          <Row
            label="Plataformas"
            value={`${financialTotals.saldosPlataformas < 0 ? '-' : ''}R$ ${formatDecimalBRL(Math.abs(financialTotals.saldosPlataformas))}`}
            valueColor={financialTotals.saldosPlataformas < 0 ? '#fb7185' : '#94a3b8'}
          />
        </div>
      </ScoreCard>

      {/* 3. Saldos dos Apps */}
      <ScoreCard accent="#a78bfa" glowClass="glow-violet">
        <CardLabel color="#a78bfa">Saldos dos Apps</CardLabel>
        <CardValue color={appBalance >= 0 ? '#a78bfa' : '#fb7185'} glowClass={appBalance >= 0 ? 'num-glow-violet' : 'num-glow-rose'}>
          {formatBRL(appBalance)}
        </CardValue>
        <Divider />
        <div className="flex flex-col gap-1">
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#e2e8f0" />Uber</span>}
            value={`R$ ${formatDecimalBRL(financialTotals.uberBalance)}`}
            valueColor={financialTotals.uberBalance >= 0 ? '#e2e8f0' : '#fb7185'}
          />
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#fbbf24" />99 App</span>}
            value={`R$ ${formatDecimalBRL(financialTotals.ninetyNineBalance)}`}
            valueColor={financialTotals.ninetyNineBalance >= 0 ? '#fbbf24' : '#fb7185'}
          />
        </div>
      </ScoreCard>

      {/* 4. Lucro Extra */}
      <ScoreCard accent="#fbbf24" glowClass="glow-amber">
        <CardLabel color="#fbbf24">Lucro Extra</CardLabel>
        <CardValue color="#fbbf24" glowClass="num-glow-amber">
          {formatBRL(financialTotals.totalValoresExtras)}
        </CardValue>
        <Divider />
        <div className="flex flex-col gap-1">
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#e2e8f0" />Uber</span>}
            value={`R$ ${formatDecimalBRL(financialTotals.valoresExtrasUber)}`}
            valueColor="#e2e8f0"
          />
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#fbbf24" />99 App</span>}
            value={`R$ ${formatDecimalBRL(financialTotals.valoresExtras99)}`}
            valueColor="#fbbf24"
          />
          {financialTotals.valoresExtrasParticular > 0 && (
            <Row
              label={<span className="flex items-center gap-1"><Dot color="#34d399" />Particular</span>}
              value={`R$ ${formatDecimalBRL(financialTotals.valoresExtrasParticular)}`}
              valueColor="#34d399"
            />
          )}
          <div className="flex justify-between items-center text-[11px] font-mono border-t border-slate-800/40 pt-1.5 mt-0.5">
            <span className="text-amber-500 font-bold font-sans">Adicional</span>
            <span className="text-amber-400 font-black">
              +{financialTotals.totalValoresOfertados > 0
                ? ((financialTotals.totalValoresExtras / financialTotals.totalValoresOfertados) * 100).toFixed(0)
                : '0'}%
            </span>
          </div>
        </div>
      </ScoreCard>

      {/* 5. Progresso da Meta */}
      <ScoreCard accent="#f59e0b" glowClass="glow-amber">
        <div className="flex justify-between items-center mb-1.5">
          <CardLabel color="#f59e0b">Progresso Meta</CardLabel>
          <button
            type="button"
            onClick={() => {
              const nextVal = !excludeSundays;
              onToggleExcludeSundays(nextVal);
              localStorage.setItem('moob_caixa_exclude_sundays', String(nextVal));
            }}
            className={`text-[8px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border transition-colors cursor-pointer ${
              excludeSundays
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'
            }`}
          >
            {excludeSundays ? 'Sem Dom.' : 'Com Dom.'}
          </button>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[22px] font-black font-mono text-amber-400 num-glow-amber leading-none">
            {monthlyGoalMath.progressPct.toFixed(0)}%
          </span>
          <span className="text-[11px] text-slate-500 font-sans">da diária</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, monthlyGoalMath.progressPct)}%`,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              boxShadow: '0 0 6px rgba(251,191,36,0.40)',
            }}
          />
        </div>
        <Divider />
        <div className="flex flex-col gap-1">
          <Row
            label="🎯 Meta"
            value={`R$ ${formatDecimalBRL(monthlyGoalMath.monthlyGoal)}`}
            valueColor="#64748b"
          />
          <Row
            label="Falta"
            value={monthlyGoalMath.faltaParaMeta <= 0 ? '✅ Atingida!' : `R$ ${formatDecimalBRL(monthlyGoalMath.faltaParaMeta)}`}
            valueColor={monthlyGoalMath.faltaParaMeta <= 0 ? '#34d399' : '#fb7185'}
          />
          <Row label="Meta/dia" value={`R$ ${formatDecimalBRL(monthlyGoalMath.dailyGoal)}`} valueColor="#94a3b8" />
        </div>
      </ScoreCard>

      {/* 6. Despesas Totais */}
      <ScoreCard accent="#fb7185" glowClass="glow-rose">
        <CardLabel color="#fb7185">Despesas Totais</CardLabel>
        <CardValue color="#fb7185" glowClass="num-glow-rose">
          {formatBRL(financialTotals.despesasTotais)}
        </CardValue>
        <Divider />
        <div className="flex flex-col gap-1">
          <Row label="Registros" value={`${financialTotals.expensesCount} lanç.`} valueColor="#e2e8f0" />
          <Row
            label="Proporção"
            value={`-${financialTotals.faturamentoBruto > 0 ? Math.round((financialTotals.despesasTotais / financialTotals.faturamentoBruto) * 100) : 0}%`}
            valueColor="#fb7185"
          />
          <div className="text-[10px] text-rose-400/70 font-sans mt-1">Deduzido do caixa geral</div>
        </div>
      </ScoreCard>

      {/* 7. Corridas por Plataforma */}
      <ScoreCard accent="#2dd4bf" glowClass="glow-teal">
        <CardLabel color="#2dd4bf">Corridas / App</CardLabel>
        <CardValue color="#2dd4bf">
          {financialTotals.ridesCount}{' '}
          <span className="text-[12px] font-sans font-normal text-slate-500">corridas</span>
        </CardValue>
        <Divider />
        <div className="flex flex-col gap-1">
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#e2e8f0" />Uber</span>}
            value={`${financialTotals.uberRidesCount} (${financialTotals.uberPercent.toFixed(0)}%)`}
            valueColor="#e2e8f0"
          />
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#fbbf24" />99 App</span>}
            value={`${financialTotals.ninetyNineRidesCount} (${financialTotals.ninetyNinePercent.toFixed(0)}%)`}
            valueColor="#fbbf24"
          />
          <Row label="Média/corr." value={formatBRL(financialTotals.avgRide)} valueColor="#94a3b8" />
        </div>
      </ScoreCard>

      {/* 8. KM Rodados */}
      <ScoreCard accent="#818cf8" glowClass="glow-indigo">
        <CardLabel color="#818cf8">KM no Turno</CardLabel>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="text-[18px] font-black font-mono text-white num-glow-white leading-none">
            {financialTotals.totalKM.toFixed(1).replace('.', ',')}
            <span className="text-[11px] font-sans font-normal text-slate-500 ml-1">KM</span>
          </span>
          {activeShift?.dailyKmGoal > 0 && (
            <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded-md">
              Meta: {activeShift.dailyKmGoal} KM
            </span>
          )}
        </div>

        {activeShift?.dailyKmGoal > 0 && (
          <div className="mt-2">
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (financialTotals.totalKM / activeShift.dailyKmGoal) * 100)}%`,
                  background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                  boxShadow: '0 0 6px rgba(129,140,248,0.40)',
                }}
              />
            </div>
          </div>
        )}

        <Divider />
        <div className="flex flex-col gap-1">
          <Row label={<span className="flex items-center gap-1"><Dot color="#e2e8f0" />Uber</span>} value={`${financialTotals.uberKM.toFixed(1).replace('.', ',')} km`} valueColor="#e2e8f0" />
          <Row label={<span className="flex items-center gap-1"><Dot color="#fbbf24" />99 App</span>} value={`${financialTotals.ninetyNineKM.toFixed(1).replace('.', ',')} km`} valueColor="#fbbf24" />
          <Row
            label={<span className="flex items-center gap-1"><Dot color="#818cf8" />Fora do App</span>}
            value={`${financialTotals.particularKM.toFixed(1).replace('.', ',')} km`}
            valueColor="#818cf8"
          />
        </div>
      </ScoreCard>

    </div>
  );
}
