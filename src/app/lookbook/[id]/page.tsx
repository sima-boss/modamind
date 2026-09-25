import { LookbookView } from "./LookbookView";

export default function LookbookPage({
  params,
}: {
  params: { id: string };
}) {
  return <LookbookView id={params.id} />;
}
