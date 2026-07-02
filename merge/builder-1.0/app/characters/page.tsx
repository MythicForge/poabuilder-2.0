import CharacterList from '@/components/CharacterList';
import PageHeader from '@/components/PageHeader';
import { getProfessions } from '@/lib/data';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Characters' };

export default function CharactersPage() {
  const professions = getProfessions().map((p) => ({ id: p.id, name: p.name }));

  return (
    <div>
      <PageHeader
        eyebrow="Characters"
        title="My Characters"
        subtitle="Your saved adventurers. Create new characters or continue an existing one."
      />
      <CharacterList professions={professions} />
    </div>
  );
}
