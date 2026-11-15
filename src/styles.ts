/** Counterparts of the Dataview plugin's stylesheet, mapped to Quartz theme variables. */
export const styles = `
.block-language-dataviewjs .dataview.small-text {
  font-size: smaller;
  color: var(--gray);
  margin-left: 3px;
}
.block-language-dataviewjs .dataview.small-text::before {
  content: "(";
}
.block-language-dataviewjs .dataview.small-text::after {
  content: ")";
}
.block-language-dataviewjs .dataview.list-view-ul {
  margin-block: 0.2em;
}
.block-language-dataviewjs pre.dataview.dataview-error {
  white-space: pre-wrap;
  padding: 0.5rem 1rem;
  border: 1px solid var(--lightgray);
  border-radius: 5px;
  color: var(--darkgray);
}
`;
