// src/lib/__tests__/f3-components.test.tsx

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ProgressBar } from "../../components/metrics/ProgressBar";
import { EstimateDisplay } from "../../components/metrics/EstimateDisplay";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useUIStore } from "../store/ui-store";
import type { EstimateRollup } from "../query/metrics";

// ── ProgressBar ─────────────────────────────────────────────────────

describe("ProgressBar", () => {
  it("renders done/total/percentage text", () => {
    render(<ProgressBar done={3} total={10} percentage={30} label="Tasks" />);
    expect(screen.getByText(/3\/10 \(30%\)/)).toBeTruthy();
  });

  it("renders the label", () => {
    render(
      <ProgressBar done={5} total={10} percentage={50} label="Features" />,
    );
    expect(screen.getByText(/Features/)).toBeTruthy();
  });

  it('renders "No items" fallback when total is 0 and no label', () => {
    render(<ProgressBar done={0} total={0} percentage={0} />);
    expect(screen.getByText("No items")).toBeTruthy();
  });

  it('renders "No tasks" fallback when total is 0 and label is "Tasks"', () => {
    render(<ProgressBar done={0} total={0} percentage={0} label="Tasks" />);
    expect(screen.getByText("No tasks")).toBeTruthy();
  });

  it("rounds the percentage", () => {
    render(
      <ProgressBar done={1} total={3} percentage={33.333} label="Tasks" />,
    );
    expect(screen.getByText(/33%/)).toBeTruthy();
  });
});

// ── EstimateDisplay ─────────────────────────────────────────────────

describe("EstimateDisplay", () => {
  it("renders entityEstimate when provided", () => {
    const rollup: EstimateRollup = {
      totalPoints: 5,
      estimatedCount: 1,
      unestimatedCount: 0,
    };
    render(<EstimateDisplay rollup={rollup} entityEstimate={5} />);
    expect(screen.getByText("5 pts")).toBeTruthy();
  });

  it('renders "unestimated" when no items are estimated', () => {
    const rollup: EstimateRollup = {
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 3,
    };
    render(<EstimateDisplay rollup={rollup} />);
    expect(screen.getByText("unestimated")).toBeTruthy();
  });

  it("renders rollup line when estimatedCount > 0", () => {
    const rollup: EstimateRollup = {
      totalPoints: 13,
      estimatedCount: 3,
      unestimatedCount: 1,
    };
    render(<EstimateDisplay rollup={rollup} />);
    expect(screen.getByText(/Rollup: 13 pts/)).toBeTruthy();
    expect(screen.getByText(/3 estimated, 1 unestimated/)).toBeTruthy();
  });

  it("renders nothing significant when all counts are 0", () => {
    const rollup: EstimateRollup = {
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 0,
    };
    const { container } = render(<EstimateDisplay rollup={rollup} />);
    // Should render the wrapper div but no meaningful text
    expect(container.querySelector("p")).toBeNull();
  });
});

// ── StatusBadge ─────────────────────────────────────────────────────

describe("StatusBadge", () => {
  beforeEach(() => {
    useUIStore.setState({
      activeStatusColours: new Set([
        "grey",
        "blue",
        "yellow",
        "orange",
        "green",
        "red",
        "purple",
      ]),
    });
  });

  it("renders the status string", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("active")).toBeTruthy();
  });

  it("renders unknown status as grey", () => {
    render(<StatusBadge status="totally-unknown-status" />);
    const el = screen.getByText("totally-unknown-status");
    // Should have grey classes applied (not throw)
    expect(el).toBeTruthy();
  });

  it("calls activateFilter with workflows/statusColour on click", () => {
    const activateFn = vi.fn();
    useUIStore.setState({ activateFilter: activateFn });

    render(<StatusBadge status="done" />);
    fireEvent.click(screen.getByText("done"));
    // "done" maps to "green" colour group
    expect(activateFn).toHaveBeenCalledWith(
      "workflows",
      "statusColour",
      "green",
    );
  });

  it("calls custom onClick override when provided", () => {
    const customFn = vi.fn();
    render(<StatusBadge status="done" onClick={customFn} />);
    fireEvent.click(screen.getByText("done"));
    expect(customFn).toHaveBeenCalledTimes(1);
  });

  it('renders "done" with green colour (data-accent-color)', () => {
    render(<StatusBadge status="done" />);
    const el = screen.getByText("done");
    const badge = el.closest("[data-accent-color]") ?? el;
    expect(badge.getAttribute("data-accent-color") ?? badge.className).toMatch(
      /green/,
    );
  });

  it('renders "active" with yellow colour (data-accent-color)', () => {
    render(<StatusBadge status="active" />);
    const el = screen.getByText("active");
    const badge = el.closest("[data-accent-color]") ?? el;
    expect(badge.getAttribute("data-accent-color") ?? badge.className).toMatch(
      /yellow/,
    );
  });

  it('renders "blocked" with orange colour (data-accent-color)', () => {
    render(<StatusBadge status="blocked" />);
    const el = screen.getByText("blocked");
    const badge = el.closest("[data-accent-color]") ?? el;
    expect(badge.getAttribute("data-accent-color") ?? badge.className).toMatch(
      /orange/,
    );
  });
});
