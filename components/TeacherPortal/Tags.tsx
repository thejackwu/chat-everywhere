import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import useTeacherTags from '@/hooks/useTeacherTags';

import { Tag as TagType } from '@/types/tags';

import { Button } from '../ui/button';
import NewTagButton from './Tags/NewTagButton';
import Tag from './Tags/Tag';

const Tags = ({ tags }: { tags: TagType[] }) => {
  const { t } = useTranslation('model');
  const { removeTeacherTags, addTeacherTag } = useTeacherTags();
  const { mutateAsync: removeTags } = removeTeacherTags;
  const { mutate: addTag } = addTeacherTag;
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  const handleRemoveTag = () => {
    const selectedTagDetails = tags.filter((tag) =>
      selectedTags.includes(tag.id),
    );
    const allTagsHaveNoMessages = selectedTagDetails.every(
      (tag) => tag.message_count === 0,
    );
    const proceedWithRemoval =
      allTagsHaveNoMessages ||
      confirm(
        t(
          'Selected tags have student submissions. Are you sure you want to remove all selected tags?',
        ) as string,
      );

    if (proceedWithRemoval) {
      removeTags(selectedTags).then((res) => {
        if (res.isRemoved) {
          setSelectedTags([]);
        }
      });
    }
  };
  return (
    <div className="">
      <h1 className="font-bold mb-4">{t('Tags')}</h1>
      <div className="flex gap-4 flex-wrap min-h-[10rem] content-start">
        {tags.map((tag) => (
          <Tag
            key={tag.id}
            label={tag.name}
            count={tag.message_count}
            onSelect={() => {
              if (selectedTags.includes(tag.id)) {
                setSelectedTags(selectedTags.filter((id) => id !== tag.id));
              } else {
                setSelectedTags([...selectedTags, tag.id]);
              }
            }}
            selected={selectedTags.includes(tag.id)}
          />
        ))}
      </div>
      <div className="flex items-center">
        <NewTagButton
          onAddTag={(tag_name) => {
            addTag(tag_name);
          }}
        />
        <Button
          onClick={handleRemoveTag}
          variant={selectedTags.length === 0 ? 'outline' : 'destructive'}
          disabled={selectedTags.length === 0}
          className="transition-[background]"
        >
          Remove
        </Button>
      </div>
    </div>
  );
};

export default Tags;