# Gavel Planner

Plan your hackathon judging setup before the event. Runs a Monte Carlo simulation of the [CrowdBT](https://github.com/anishathalye/gavel) pairwise comparison algorithm entirely in your browser to answer: how many judges do I need, and how accurate will rankings be?

**Recommend mode** finds the minimum judges for a target confidence level. **Custom mode** lets you explore accuracy curves with full parameter control. Toggle between **Shortlist** (top N identification) and **Full ranking** goals.

Part of [Gavel 2](https://github.com/skelston/gavel2).

## Development

```bash
npm ci
npm run dev
```

## License

[AGPL-3.0](https://github.com/skelston/gavel2/blob/replace-master/LICENSE.txt)
