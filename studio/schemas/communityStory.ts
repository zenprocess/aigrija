import { defineType, defineField } from 'sanity'

export const communityStory = defineType({
  name: 'communityStory',
  title: 'Community Story',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'language',
      title: 'Language',
      type: 'string',
      options: {
        list: [
          { title: 'Romanian', value: 'ro' },
          { title: 'English', value: 'en' },
          { title: 'Bulgarian', value: 'bg' },
          { title: 'Hungarian', value: 'hu' },
          { title: 'Ukrainian', value: 'uk' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'translationKey',
      title: 'Translation Key',
      type: 'string',
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: [{ type: 'author' }],
    }),
    defineField({
      name: 'authorName',
      title: 'Author Name',
      description: 'Display name (not a reference to an Author document)',
      type: 'string',
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      name: 'scamType',
      title: 'Scam Type',
      type: 'string',
      options: {
        list: [
          { title: 'Phishing (email/web)', value: 'phishing' },
          { title: 'Smishing (SMS)', value: 'smishing' },
          { title: 'Vishing (phone call)', value: 'vishing' },
          { title: 'Marketplace fraud', value: 'marketplace' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'outcome',
      title: 'Outcome',
      type: 'string',
      options: {
        list: [
          { title: 'Avoided', value: 'avoided' },
          { title: 'Reported', value: 'reported' },
          { title: 'Recovered', value: 'recovered' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'approved',
      title: 'Approved',
      description: 'Moderation approval for public visibility',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: 'title', scamType: 'scamType', approved: 'approved' },
    prepare({ title, scamType, approved }: { title: string; scamType: string; approved: boolean }) {
      return {
        title,
        subtitle: `${scamType || ''} ${approved ? '(approved)' : '(pending)'}`,
      }
    },
  },
})
