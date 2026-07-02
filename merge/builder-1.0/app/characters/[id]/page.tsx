import CharacterSheetPage from "@/components/CharacterSheet";
import {
  getBuilderProfessions,
  getBuilderOrigins,
  getBuilderFeats,
  getBuilderSpells,
  getItemCatalog,
  getChoiceFeatures,
} from "@/lib/builderData";

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const professions = getBuilderProfessions();
  const origins = getBuilderOrigins();
  const { professionFeats, originFeats } = getBuilderFeats();
  const spells = getBuilderSpells();
  const catalog = getItemCatalog();
  const choiceFeatures = getChoiceFeatures();

  return (
    <CharacterSheetPage
      id={id}
      professions={professions}
      origins={origins}
      professionFeats={professionFeats}
      originFeats={originFeats}
      spells={spells}
      catalog={catalog}
      choiceFeatures={choiceFeatures}
    />
  );
}
