import { author } from './author'
import { bankGuide } from './bankGuide'
import { blockContent } from './blockContent'
import { blogPost } from './blogPost'
import { category } from './category'
import { communityStory } from './communityStory'
import { pressRelease } from './pressRelease'
import { schoolModule } from './schoolModule'
import { threatReport } from './threatReport'
import { weeklyDigest } from './weeklyDigest'

export const schemaTypes = [
  // Supporting types (must be before documents that reference them)
  blockContent,
  author,
  category,
  // Document types
  blogPost,
  threatReport,
  bankGuide,
  weeklyDigest,
  schoolModule,
  communityStory,
  pressRelease,
]
